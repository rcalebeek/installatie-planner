import React, { useState, useRef, useEffect } from 'react';
import { Upload, Square, Save, FolderOpen, FileDown, X, Check, Edit2, Trash2, Settings, Cloud, HardDrive } from 'lucide-react';

const COLORS = { A: '#FF6B6B', B: '#4ECDC4', C: '#45B7D1', D: '#FFA07A', E: '#98D8C8', F: '#F7DC6F', G: '#BB8FCE' };

export default function App() {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);
  const [isDrawingRoom, setIsDrawingRoom] = useState(false);
  const [roomStart, setRoomStart] = useState(null);
  const [tempRoom, setTempRoom] = useState(null);
  const [showLegendEdit, setShowLegendEdit] = useState(false);
  const [legend, setLegend] = useState({ A: 'Armatuur', B: 'Wandcontactdoos', C: 'PIR Sensor', D: 'Schakelaar', E: 'WHOOP Detector', F: 'Verlichting', G: 'Overig' });
  const [showProjects, setShowProjects] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [newRoomData, setNewRoomData] = useState(null);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [useCloud, setUseCloud] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [supabaseClient, setSupabaseClient] = useState(null);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    const savedUrl = localStorage.getItem('supabaseUrl');
    const savedKey = localStorage.getItem('supabaseKey');
    const savedUseCloud = localStorage.getItem('useCloud') === 'true';
    if (savedUrl) setSupabaseUrl(savedUrl);
    if (savedKey) setSupabaseKey(savedKey);
    setUseCloud(savedUseCloud);
    if (savedUrl && savedKey) initializeSupabase(savedUrl, savedKey);
  }, []);

  const initializeSupabase = (url, key) => {
    if (!url || !key) return null;
    const client = {
      url, key,
      from: (table) => ({
        select: async () => {
          try {
            const res = await fetch(`${url}/rest/v1/${table}?select=*&order=created_at.desc`, { 
              headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            return { data, error: null };
          } catch (error) {
            console.error('Select error:', error);
            return { data: null, error };
          }
        },
        insert: async (record) => {
          try {
            const res = await fetch(`${url}/rest/v1/${table}`, { 
              method: 'POST', 
              headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, 
              body: JSON.stringify(record) 
            });
            const data = await res.json();
            return { data, error: null };
          } catch (error) {
            console.error('Insert error:', error);
            return { data: null, error };
          }
        },
        update: async (record) => ({ 
          eq: async (col, val) => {
            try {
              const res = await fetch(`${url}/rest/v1/${table}?${col}=eq.${val}`, { 
                method: 'PATCH', 
                headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }, 
                body: JSON.stringify(record) 
              });
              return { error: null };
            } catch (error) {
              console.error('Update error:', error);
              return { error };
            }
          }
        }),
        delete: () => ({ 
          eq: async (col, val) => {
            try {
              await fetch(`${url}/rest/v1/${table}?${col}=eq.${val}`, { 
                method: 'DELETE', 
                headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
              });
              return { error: null };
            } catch (error) {
              console.error('Delete error:', error);
              return { error };
            }
          }
        })
      })
    };
    setSupabaseClient(client);
    return client;
  };

  const saveSettings = () => {
    localStorage.setItem('supabaseUrl', supabaseUrl);
    localStorage.setItem('supabaseKey', supabaseKey);
    localStorage.setItem('useCloud', useCloud.toString());
    if (supabaseUrl && supabaseKey) {
      initializeSupabase(supabaseUrl, supabaseKey);
      alert('Supabase instellingen opgeslagen!');
    }
    setShowSettings(false);
    if (useCloud && supabaseUrl && supabaseKey) loadCloudProjects();
    else loadLocalProjects();
  };

  const loadLocalProjects = () => {
    const saved = localStorage.getItem('installationProjects');
    if (saved) setProjects(JSON.parse(saved));
  };

  const loadCloudProjects = async () => {
    if (!supabaseClient) return;
    setIsLoading(true);
    const { data, error } = await supabaseClient.from('projects').select();
    if (error) {
      console.error('Error loading:', error);
      alert('Fout bij laden van projecten');
    } else {
      setProjects(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (useCloud && supabaseClient) loadCloudProjects();
    else loadLocalProjects();
  }, [useCloud, supabaseClient]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target.result);
        setAnnotations([]);
        setRooms([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * canvas.width / rect.width, y: (e.clientY - rect.top) * canvas.height / rect.height };
  };

  const handleCanvasClick = (e) => {
    const coords = getCanvasCoordinates(e);
    if (selectedTool === 'delete') {
      const clicked = annotations.find(ann => Math.sqrt(Math.pow(ann.x - coords.x, 2) + Math.pow(ann.y - coords.y, 2)) < 30);
      if (clicked) setAnnotations(annotations.filter(ann => ann.id !== clicked.id));
      return;
    }
    if (!selectedTool || selectedTool === 'delete') return;
    if (selectedTool === 'room') {
      if (!isDrawingRoom) {
        setIsDrawingRoom(true);
        setRoomStart(coords);
      } else {
        setNewRoomData({ x: Math.min(roomStart.x, coords.x), y: Math.min(roomStart.y, coords.y), width: Math.abs(coords.x - roomStart.x), height: Math.abs(coords.y - roomStart.y) });
        setShowRoomModal(true);
        setRoomNameInput('');
      }
    } else {
      const room = rooms.find(r => coords.x >= r.x && coords.x <= r.x + r.width && coords.y >= r.y && coords.y <= r.y + r.height);
      setAnnotations([...annotations, { id: Date.now(), type: selectedTool, x: coords.x, y: coords.y, roomId: room?.id || null, roomName: room?.name || 'Ongedefinieerd' }]);
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (isDrawingRoom && roomStart) {
      const coords = getCanvasCoordinates(e);
      setTempRoom({ x: Math.min(roomStart.x, coords.x), y: Math.min(roomStart.y, coords.y), width: Math.abs(coords.x - roomStart.x), height: Math.abs(coords.y - roomStart.y) });
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !uploadedImage) return;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    if (img && img.complete) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      rooms.forEach(room => {
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(room.x, room.y, room.width, room.height);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
        ctx.fillRect(room.x, room.y, room.width, room.height);
        ctx.fillStyle = '#2196F3';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(room.name, room.x + 10, room.y + 30);
      });
      if (tempRoom) {
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(tempRoom.x, tempRoom.y, tempRoom.width, tempRoom.height);
        ctx.setLineDash([]);
      }
      annotations.forEach(ann => {
        ctx.fillStyle = COLORS[ann.type];
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(ann.type, ann.x, ann.y);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      });
    }
  };

  useEffect(() => {
    if (uploadedImage) {
      const img = new Image();
      img.onload = () => { imageRef.current = img; drawCanvas(); };
      img.src = uploadedImage;
    }
  }, [uploadedImage]);

  useEffect(() => { drawCanvas(); }, [annotations, rooms, tempRoom]);

  const saveProjects = (updated) => {
    localStorage.setItem('installationProjects', JSON.stringify(updated));
    setProjects(updated);
  };

  const saveProject = async () => {
    if (!projectName.trim()) return alert('Geef het project een naam');
    const project = { name: projectName, image: uploadedImage, annotations, rooms, legend };
    setIsLoading(true);
    if (useCloud && supabaseClient) {
      try {
        console.log('Saving to Supabase...');
        if (currentProject?.id) {
          await supabaseClient.from('projects').update({ ...project, updated_at: new Date().toISOString() }).eq('id', currentProject.id);
        } else {
          await supabaseClient.from('projects').insert([project]);
        }
        alert('Project opgeslagen in cloud!');
        await loadCloudProjects();
      } catch (error) {
        console.error('Save error:', error);
        alert('Fout bij opslaan: ' + error.message);
      }
    } else {
      const projectWithId = { ...project, id: currentProject?.id || Date.now(), savedAt: new Date().toISOString() };
      const idx = projects.findIndex(p => p.id === projectWithId.id);
      const updated = idx >= 0 ? [...projects.slice(0, idx), projectWithId, ...projects.slice(idx + 1)] : [...projects, projectWithId];
      saveProjects(updated);
      setCurrentProject(projectWithId);
      alert('Project lokaal opgeslagen!');
    }
    setIsLoading(false);
  };

  const loadProject = (p) => {
    setCurrentProject(p);
    setProjectName(p.name);
    setUploadedImage(p.image);
    setAnnotations(p.annotations || []);
    setRooms(p.rooms || []);
    setLegend(p.legend);
    setShowProjects(false);
  };

  const deleteProject = async (id) => {
    if (!window.confirm('Weet je zeker dat je dit project wilt verwijderen?')) return;
    setIsLoading(true);
    if (useCloud && supabaseClient) {
      await supabaseClient.from('projects').delete().eq('id', id);
      await loadCloudProjects();
    } else {
      saveProjects(projects.filter(p => p.id !== id));
    }
    setIsLoading(false);
  };

  const exportToPDF = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imgData = canvas.toDataURL('image/png');
    const countsByRoom = {};
    rooms.forEach(r => { countsByRoom[r.name] = {}; Object.keys(COLORS).forEach(k => countsByRoom[r.name][k] = 0); });
    countsByRoom['Ongedefinieerd'] = {};
    Object.keys(COLORS).forEach(k => countsByRoom['Ongedefinieerd'][k] = 0);
    annotations.forEach(ann => { const rn = ann.roomName || 'Ongedefinieerd'; if (countsByRoom[rn]) countsByRoom[rn][ann.type]++; });
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Installatie Project</title><style>@media print{.no-print{display:none}.page-break{page-break-after:always}}body{font-family:Arial;margin:20px}h1{color:#2196F3;border-bottom:3px solid #2196F3;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #ddd;padding:10px}th{background:#2196F3;color:white}.total-row{font-weight:bold;background:#e3f2fd}.print-button{background:#2196F3;color:white;padding:12px 24px;border:none;border-radius:5px;cursor:pointer}</style></head><body><div class="no-print" style="text-align:center;margin:20px"><button class="print-button" onclick="window.print()">Afdrukken / PDF</button></div><h1>${projectName || 'Project'}</h1><p><strong>Datum:</strong> ${new Date().toLocaleDateString('nl-NL')}</p><h2>Plattegrond</h2><img src="${imgData}" style="max-width:100%;border:2px solid #ddd"/><div class="page-break"></div><h1>Materiaal Overzicht</h1><table><thead><tr><th>Ruimte</th>${Object.keys(COLORS).map(k => `<th>${k} - ${legend[k]}</th>`).join('')}<th>Totaal</th></tr></thead><tbody>${Object.entries(countsByRoom).map(([rn, counts]) => { const tot = Object.values(counts).reduce((a,b) => a+b, 0); return tot === 0 ? '' : `<tr><td><strong>${rn}</strong></td>${Object.keys(COLORS).map(k => `<td>${counts[k]||0}</td>`).join('')}<td><strong>${tot}</strong></td></tr>`; }).filter(r=>r).join('')}<tr class="total-row"><td><strong>TOTAAL</strong></td>${Object.keys(COLORS).map(k => { const tot = Object.values(countsByRoom).reduce((s, r) => s + (r[k]||0), 0); return `<td><strong>${tot}</strong></td>`; }).join('')}<td><strong>${annotations.length}</strong></td></tr></tbody></table></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const deleteRoom = (id) => {
    setRooms(rooms.filter(r => r.id !== id));
    setAnnotations(annotations.map(ann => ann.roomId === id ? { ...ann, roomId: null, roomName: 'Ongedefinieerd' } : ann));
  };

  const confirmRoomName = () => {
    if (roomNameInput.trim() && newRoomData) setRooms([...rooms, { id: Date.now(), name: roomNameInput.trim(), ...newRoomData }]);
    setShowRoomModal(false);
    setIsDrawingRoom(false);
    setRoomStart(null);
    setTempRoom(null);
    setSelectedTool(null);
    setNewRoomData(null);
    setRoomNameInput('');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-md p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-blue-600">Installatie Planner</h1>
          <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project naam..." className="px-3 py-2 border rounded-lg" />
          {useCloud && supabaseClient ? <span className="flex items-center gap-1 text-sm text-green-600"><Cloud size={16}/>Cloud</span> : <span className="flex items-center gap-1 text-sm text-gray-600"><HardDrive size={16}/>Lokaal</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"><Settings size={20}/>Instellingen</button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Upload size={20}/>Upload</button>
          <button onClick={() => setShowProjects(!showProjects)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><FolderOpen size={20}/>Projecten</button>
          <button onClick={saveProject} disabled={!uploadedImage || isLoading} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"><Save size={20}/>{isLoading ? 'Bezig...' : 'Opslaan'}</button>
          <button onClick={exportToPDF} disabled={!uploadedImage} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"><FileDown size={20}/>Export</button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">Instellingen</h2><button onClick={() => setShowSettings(false)}><X size={24}/></button></div>
            <div className="space-y-4">
              <div><h3 className="font-bold mb-2">Opslag</h3><div className="flex gap-4"><label className="flex items-center gap-2"><input type="radio" checked={!useCloud} onChange={() => setUseCloud(false)}/><HardDrive size={20}/>Lokaal</label><label className="flex items-center gap-2"><input type="radio" checked={useCloud} onChange={() => setUseCloud(true)}/><Cloud size={20}/>Cloud</label></div></div>
              {useCloud && (<><div><label className="block font-semibold mb-2">Supabase URL</label><input type="text" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} placeholder="https://xxxxx.supabase.co" className="w-full px-3 py-2 border rounded-lg"/></div><div><label className="block font-semibold mb-2">API Key</label><input type="password" value={supabaseKey} onChange={(e) => setSupabaseKey(e.target.value)} className="w-full px-3 py-2 border rounded-lg"/></div></>)}
              <div className="flex gap-2"><button onClick={saveSettings} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">Opslaan</button><button onClick={() => setShowSettings(false)} className="px-4 py-2 bg-gray-300 rounded-lg">Annuleren</button></div>
            </div>
          </div>
        </div>
      )}

      {showProjects && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold">Projecten</h2><button onClick={() => setShowProjects(false)}><X size={24}/></button></div>
            {isLoading ? <p className="text-center py-8">Laden...</p> : projects.length === 0 ? <p className="text-center py-8">Geen projecten</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{projects.map(p => (<div key={p.id} className="border rounded-lg p-4"><h3 className="font-bold mb-2">{p.name}</h3><p className="text-sm text-gray-600 mb-3">{p.annotations?.length || 0} annotaties, {p.rooms?.length || 0} ruimtes</p><div className="flex gap-2"><button onClick={() => loadProject(p)} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded">Openen</button><button onClick={() => deleteProject(p.id)} className="px-3 py-2 bg-red-600 text-white rounded"><Trash2 size={18}/></button></div></div>))}</div>
            )}
          </div>
        </div>
      )}

      {showRoomModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Naam van de ruimte</h2>
            <input type="text" value={roomNameInput} onChange={(e) => setRoomNameInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && confirmRoomName()} placeholder="bijv. Woonkamer" className="w-full px-4 py-2 border rounded-lg mb-4" autoFocus />
            <div className="flex gap-2"><button onClick={confirmRoomName} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">Bevestigen</button><button onClick={() => setShowRoomModal(false)} className="px-4 py-2 bg-gray-300 rounded-lg">Annuleren</button></div>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-80px)]">
        {uploadedImage && (
          <div className="w-80 bg-white shadow-lg p-4 overflow-auto">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3"><h3 className="font-bold text-lg">Annotaties</h3><button onClick={() => setShowLegendEdit(!showLegendEdit)} className="p-1 hover:bg-gray-100 rounded"><Edit2 size={18}/></button></div>
              {showLegendEdit && (<div className="mb-4 p-3 bg-gray-50 rounded">{Object.entries(legend).map(([k, v]) => (<div key={k} className="mb-2"><label className="text-sm font-semibold">{k}:</label><input type="text" value={v} onChange={(e) => setLegend({...legend, [k]: e.target.value})} className="w-full px-2 py-1 border rounded mt-1"/></div>))}</div>)}
              <div className="space-y-2">{Object.entries(COLORS).map(([letter, color]) => (<button key={letter} onClick={() => setSelectedTool(selectedTool === letter ? null : letter)} className={`w-full p-3 rounded-lg border-2 ${selectedTool === letter ? 'border-blue-600 shadow-lg' : 'border-gray-300'}`} style={{backgroundColor: color + '20'}}><div className="flex items-center justify-between"><span className="font-bold text-lg" style={{color}}>{letter}</span><span className="text-sm">{legend[letter]}</span></div></button>))}</div>
            </div>
            <div className="mb-6"><h3 className="font-bold text-lg mb-3">Ruimte Tekenen</h3><button onClick={() => {setSelectedTool('room');setIsDrawingRoom(false);setRoomStart(null);}} className={`w-full p-3 rounded-lg border-2 mb-2 ${selectedTool === 'room' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}><div className="flex items-center gap-2"><Square size={20}/><span>Ruimte definiëren</span></div></button><button onClick={() => setSelectedTool(selectedTool === 'delete' ? null : 'delete')} className={`w-full p-3 rounded-lg border-2 ${selectedTool === 'delete' ? 'border-red-600 bg-red-50' : '
