import { useState, useEffect, useCallback, useRef } from "react";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const DEFAULT_TASKS = [
  { id: "tel", name: "Pago de Teléfono", category: "servicios" },
  { id: "local", name: "Pago de Local", category: "alquiler" },
  { id: "luz", name: "Pago de Luz", category: "servicios" },
  { id: "agua", name: "Pago de Agua", category: "servicios" },
  { id: "kinder", name: "Pago de Kínder", category: "educación" },
  { id: "planilla-ccss", name: "Planilla CCSS", category: "planillas" },
  { id: "planilla-ins", name: "Planilla INS", category: "planillas" },
  { id: "pago-ccss", name: "Pago CCSS", category: "planillas" },
];

const CATEGORY_COLORS = {
  servicios: { bg: "#EEF2FF", border: "#818CF8", text: "#4338CA", dot: "#6366F1" },
  alquiler: { bg: "#FEF3C7", border: "#F59E0B", text: "#92400E", dot: "#F59E0B" },
  educación: { bg: "#ECFDF5", border: "#34D399", text: "#065F46", dot: "#10B981" },
  planillas: { bg: "#FFF1F2", border: "#FB7185", text: "#9F1239", dot: "#F43F5E" },
  otro: { bg: "#F3F4F6", border: "#9CA3AF", text: "#374151", dot: "#6B7280" },
};

const CATEGORY_LABELS = {
  servicios: "Servicios",
  alquiler: "Alquiler",
  educación: "Educación",
  planillas: "Planillas",
  otro: "Otro",
};

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key) {
  const [year, month] = key.split("-");
  return `${MONTHS[parseInt(month, 10) - 1]} ${year}`;
}

function getPrevMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

function getNextMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  if (month === 12) return `${year + 1}-01`;
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

// Storage helpers
async function loadData(key) {
  try {
    const result = await window.storage.get(key);
    return result ? JSON.parse(result.value) : null;
  } catch {
    return null;
  }
}

async function saveData(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value));
  } catch (e) {
    console.error("Error saving:", e);
  }
}

export default function ControlPagos() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthKey());
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [monthData, setMonthData] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState("servicios");
  const [showHistory, setShowHistory] = useState(false);
  const [animatingId, setAnimatingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("servicios");
  const [showCarryOverBanner, setShowCarryOverBanner] = useState(false);
  const [carryOverCount, setCarryOverCount] = useState(0);
  const initialized = useRef(false);

  // Load all data on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    async function init() {
      setLoading(true);
      const savedTasks = await loadData("ctrl-tasks");
      if (savedTasks) setTasks(savedTasks);

      const currentKey = getCurrentMonthKey();
      const savedMonth = await loadData(`ctrl-month-${currentKey}`);
      
      if (savedMonth) {
        setMonthData(savedMonth);
      } else {
        // Check previous month for carryover
        const prevKey = getPrevMonthKey(currentKey);
        const prevMonth = await loadData(`ctrl-month-${prevKey}`);
        const activeTasks = savedTasks || DEFAULT_TASKS;
        
        const newMonthData = {};
        let carried = 0;
        activeTasks.forEach(task => {
          const prevStatus = prevMonth?.[task.id];
          if (prevStatus && !prevStatus.done) {
            newMonthData[task.id] = { done: false, date: null, carriedOver: true };
            carried++;
          } else {
            newMonthData[task.id] = { done: false, date: null, carriedOver: false };
          }
        });
        
        setMonthData(newMonthData);
        await saveData(`ctrl-month-${currentKey}`, newMonthData);
        
        if (carried > 0) {
          setCarryOverCount(carried);
          setShowCarryOverBanner(true);
          setTimeout(() => setShowCarryOverBanner(false), 5000);
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  // Load month data when switching months
  useEffect(() => {
    if (loading) return;
    async function loadMonth() {
      const saved = await loadData(`ctrl-month-${currentMonth}`);
      if (saved) {
        setMonthData(saved);
      } else {
        const newData = {};
        tasks.forEach(t => {
          newData[t.id] = { done: false, date: null, carriedOver: false };
        });
        setMonthData(newData);
      }
    }
    loadMonth();
  }, [currentMonth, loading]);

  const toggleTask = useCallback(async (taskId) => {
    setAnimatingId(taskId);
    setTimeout(() => setAnimatingId(null), 600);
    
    const current = monthData[taskId] || { done: false, date: null };
    const updated = {
      ...monthData,
      [taskId]: {
        done: !current.done,
        date: !current.done ? new Date().toLocaleDateString("es-CR") : null,
        carriedOver: current.carriedOver || false,
      }
    };
    setMonthData(updated);
    await saveData(`ctrl-month-${currentMonth}`, updated);
  }, [monthData, currentMonth]);

  const addTask = useCallback(async () => {
    if (!newTaskName.trim()) return;
    const id = `custom-${Date.now()}`;
    const newTask = { id, name: newTaskName.trim(), category: newTaskCategory };
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    await saveData("ctrl-tasks", updatedTasks);
    
    const updatedMonth = {
      ...monthData,
      [id]: { done: false, date: null, carriedOver: false }
    };
    setMonthData(updatedMonth);
    await saveData(`ctrl-month-${currentMonth}`, updatedMonth);
    
    setNewTaskName("");
    setNewTaskCategory("servicios");
    setShowAddTask(false);
  }, [newTaskName, newTaskCategory, tasks, monthData, currentMonth]);

  const removeTask = useCallback(async (taskId) => {
    if (!confirm("¿Eliminar esta responsabilidad?")) return;
    const updatedTasks = tasks.filter(t => t.id !== taskId);
    setTasks(updatedTasks);
    await saveData("ctrl-tasks", updatedTasks);
    
    const { [taskId]: _, ...rest } = monthData;
    setMonthData(rest);
    await saveData(`ctrl-month-${currentMonth}`, rest);
  }, [tasks, monthData, currentMonth]);

  const startEdit = useCallback((task) => {
    setEditingId(task.id);
    setEditName(task.name);
    setEditCategory(task.category || "otro");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editName.trim() || !editingId) return;
    const updatedTasks = tasks.map(t =>
      t.id === editingId ? { ...t, name: editName.trim(), category: editCategory } : t
    );
    setTasks(updatedTasks);
    await saveData("ctrl-tasks", updatedTasks);
    setEditingId(null);
    setEditName("");
  }, [editingId, editName, editCategory, tasks]);

  const resetMonth = useCallback(async () => {
    const newData = {};
    tasks.forEach(t => {
      newData[t.id] = { done: false, date: null, carriedOver: false };
    });
    setMonthData(newData);
    await saveData(`ctrl-month-${currentMonth}`, newData);
  }, [tasks, currentMonth]);

  const isCurrentMonth = currentMonth === getCurrentMonthKey();
  const completedCount = tasks.filter(t => monthData[t.id]?.done).length;
  const pendingCount = tasks.length - completedCount;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;
  const carriedOverTasks = tasks.filter(t => monthData[t.id]?.carriedOver && !monthData[t.id]?.done);

  // Group tasks by category
  const grouped = {};
  tasks.forEach(t => {
    const cat = t.category || "otro";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  });

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FAF9F6",
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 40, height: 40, border: "3px solid #E5E7EB",
            borderTopColor: "#4338CA", borderRadius: "50%",
            animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
          }} />
          <p style={{ color: "#6B7280", fontSize: 14 }}>Cargando datos...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#FAF9F6",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      color: "#1F2937",
      paddingBottom: 60,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=DM+Serif+Display&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes checkPop {
          0% { transform: scale(1); }
          40% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bannerSlide {
          from { opacity: 0; transform: translateY(-100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bannerOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-100%); }
        }
        * { box-sizing: border-box; }
        button { cursor: pointer; }
        input { font-family: inherit; }
      `}</style>

      {/* Carry-over banner */}
      {showCarryOverBanner && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
          padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          borderBottom: "2px solid #F59E0B",
          animation: "bannerSlide 0.4s ease-out",
          fontSize: 14, fontWeight: 500, color: "#92400E",
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          {carryOverCount} {carryOverCount === 1 ? "pago pendiente arrastrado" : "pagos pendientes arrastrados"} del mes anterior
          <button onClick={() => setShowCarryOverBanner(false)} style={{
            background: "none", border: "none", color: "#92400E",
            fontSize: 18, padding: 4, marginLeft: 8, lineHeight: 1,
          }}>×</button>
        </div>
      )}

      {/* Header */}
      <div style={{
        background: "linear-gradient(160deg, #312E81 0%, #4338CA 50%, #6366F1 100%)",
        padding: "36px 24px 28px",
        color: "white",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h1 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 28, fontWeight: 400, margin: "0 0 4px",
            letterSpacing: "-0.02em",
          }}>
            Control de Pagos
          </h1>
          <p style={{ fontSize: 13, opacity: 0.75, margin: 0 }}>
            Tus responsabilidades mensuales en un solo lugar
          </p>

          {/* Month nav */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 24, background: "rgba(255,255,255,0.12)",
            borderRadius: 12, padding: "8px 6px",
          }}>
            <button onClick={() => setCurrentMonth(getPrevMonthKey(currentMonth))} style={{
              background: "rgba(255,255,255,0.1)", border: "none", color: "white",
              width: 36, height: 36, borderRadius: 8, fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s",
            }} onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.2)"}
               onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.1)"}>
              ‹
            </button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>
                {getMonthLabel(currentMonth)}
              </div>
              {isCurrentMonth && (
                <div style={{
                  fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em",
                  opacity: 0.7, marginTop: 2,
                }}>Mes actual</div>
              )}
            </div>
            <button onClick={() => setCurrentMonth(getNextMonthKey(currentMonth))} style={{
              background: "rgba(255,255,255,0.1)", border: "none", color: "white",
              width: 36, height: 36, borderRadius: 8, fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s",
            }} onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.2)"}
               onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.1)"}>
              ›
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 20 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", fontSize: 12,
              marginBottom: 8, opacity: 0.85,
            }}>
              <span>{completedCount} completados</span>
              <span>{pendingCount} pendientes</span>
            </div>
            <div style={{
              height: 6, background: "rgba(255,255,255,0.2)", borderRadius: 3,
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: `${progress}%`,
                background: progress === 100
                  ? "linear-gradient(90deg, #34D399, #10B981)"
                  : "linear-gradient(90deg, #FDE68A, #FBBF24)",
                borderRadius: 3,
                transition: "width 0.5s ease",
              }} />
            </div>
            {progress === 100 && (
              <p style={{
                textAlign: "center", fontSize: 13, marginTop: 10,
                animation: "fadeIn 0.5s ease",
              }}>
                ✨ ¡Todo al día este mes!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>

        {/* Carried over alert */}
        {carriedOverTasks.length > 0 && (
          <div style={{
            background: "#FEF3C7", border: "1px solid #FDE68A",
            borderRadius: 10, padding: "12px 16px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 10,
            animation: "fadeIn 0.3s ease",
          }}>
            <span style={{ fontSize: 20 }}>📌</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>
                Pendientes del mes anterior
              </div>
              <div style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>
                {carriedOverTasks.map(t => t.name).join(", ")}
              </div>
            </div>
          </div>
        )}

        {/* Task groups */}
        {Object.entries(grouped).map(([cat, catTasks], gi) => {
          const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.otro;
          return (
            <div key={cat} style={{
              marginBottom: 20,
              animation: `fadeIn 0.4s ease ${gi * 0.08}s both`,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 10, paddingLeft: 2,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: colors.dot,
                }} />
                <span style={{
                  fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: "0.06em", color: colors.text,
                }}>
                  {CATEGORY_LABELS[cat] || cat}
                </span>
                <div style={{
                  flex: 1, height: 1, background: colors.border, opacity: 0.25,
                }} />
              </div>

              {catTasks.map((task, i) => {
                const status = monthData[task.id] || { done: false, date: null };
                const isAnimating = animatingId === task.id;
                const isEditing = editingId === task.id;

                if (isEditing) {
                  return (
                    <div key={task.id} style={{
                      padding: "14px 16px", marginBottom: 6,
                      background: "white", border: "2px solid #818CF8",
                      borderRadius: 10, animation: "slideDown 0.3s ease",
                    }}>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Nombre..."
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        style={{
                          width: "100%", padding: "8px 12px", border: "1.5px solid #E5E7EB",
                          borderRadius: 7, fontSize: 14, outline: "none", fontFamily: "inherit",
                          marginBottom: 10, transition: "border-color 0.2s",
                        }}
                        onFocus={e => e.target.style.borderColor = "#818CF8"}
                        onBlur={e => e.target.style.borderColor = "#E5E7EB"}
                      />
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                          const colors = CATEGORY_COLORS[key];
                          const selected = editCategory === key;
                          return (
                            <button key={key} onClick={() => setEditCategory(key)} style={{
                              padding: "5px 12px", borderRadius: 16, fontSize: 11, fontWeight: 500,
                              border: selected ? `2px solid ${colors.dot}` : "1.5px solid #E5E7EB",
                              background: selected ? colors.bg : "white",
                              color: selected ? colors.text : "#6B7280",
                              transition: "all 0.2s",
                            }}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={saveEdit} style={{
                          flex: 1, padding: "8px 0", background: "#4338CA",
                          color: "white", border: "none", borderRadius: 7,
                          fontSize: 12, fontWeight: 600, transition: "background 0.2s",
                        }}
                          onMouseEnter={e => e.target.style.background = "#3730A3"}
                          onMouseLeave={e => e.target.style.background = "#4338CA"}
                        >Guardar</button>
                        <button onClick={() => setEditingId(null)} style={{
                          padding: "8px 16px", background: "#F3F4F6",
                          color: "#6B7280", border: "none", borderRadius: 7,
                          fontSize: 12, fontWeight: 500, transition: "background 0.2s",
                        }}
                          onMouseEnter={e => e.target.style.background = "#E5E7EB"}
                          onMouseLeave={e => e.target.style.background = "#F3F4F6"}
                        >Cancelar</button>
                        <button onClick={() => { setEditingId(null); removeTask(task.id); }} style={{
                          padding: "8px 16px", background: "#FEF2F2",
                          color: "#EF4444", border: "1px solid #FECACA", borderRadius: 7,
                          fontSize: 12, fontWeight: 500, transition: "all 0.2s",
                        }}
                          onMouseEnter={e => { e.target.style.background = "#FEE2E2"; e.target.style.borderColor = "#FCA5A5"; }}
                          onMouseLeave={e => { e.target.style.background = "#FEF2F2"; e.target.style.borderColor = "#FECACA"; }}
                        >Eliminar</button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={task.id} style={{
                    display: "flex", alignItems: "center",
                    padding: "14px 16px",
                    marginBottom: 6,
                    background: status.done ? "#F9FAFB" : "white",
                    border: `1.5px solid ${status.done ? "#E5E7EB" : status.carriedOver ? "#FDE68A" : colors.border + "40"}`,
                    borderRadius: 10,
                    transition: "all 0.3s ease",
                    animation: `fadeIn 0.3s ease ${(gi * 0.08) + (i * 0.04)}s both`,
                    position: "relative",
                    overflow: "hidden",
                  }}>
                    {status.carriedOver && !status.done && (
                      <div style={{
                        position: "absolute", top: 0, left: 0,
                        width: 3, height: "100%",
                        background: "#F59E0B",
                      }} />
                    )}

                    {/* Checkbox */}
                    <button onClick={() => toggleTask(task.id)} style={{
                      width: 26, height: 26, borderRadius: 7,
                      border: status.done ? "none" : `2px solid ${colors.border}80`,
                      background: status.done
                        ? `linear-gradient(135deg, ${colors.dot}, ${colors.border})`
                        : "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginRight: 14, flexShrink: 0,
                      transition: "all 0.2s ease",
                      animation: isAnimating ? "checkPop 0.4s ease" : "none",
                    }}>
                      {status.done && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2.2"
                            strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>

                    {/* Task info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 500,
                        color: status.done ? "#9CA3AF" : "#1F2937",
                        textDecoration: status.done ? "line-through" : "none",
                        transition: "color 0.3s",
                      }}>
                        {task.name}
                      </div>
                      {status.done && status.date && (
                        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                          Pagado el {status.date}
                        </div>
                      )}
                      {status.carriedOver && !status.done && (
                        <div style={{ fontSize: 11, color: "#D97706", marginTop: 2 }}>
                          Arrastrado del mes anterior
                        </div>
                      )}
                    </div>

                    {/* Edit button */}
                    <button onClick={() => startEdit(task)} style={{
                      background: "none", border: "none", color: "#D1D5DB",
                      padding: "4px 8px", fontSize: 13, lineHeight: 1,
                      transition: "color 0.2s", flexShrink: 0,
                    }}
                      onMouseEnter={e => e.target.style.color = "#818CF8"}
                      onMouseLeave={e => e.target.style.color = "#D1D5DB"}
                      title="Editar"
                    >
                      ✎
                    </button>

                    {/* Status badge */}
                    <div style={{
                      fontSize: 10, fontWeight: 600,
                      padding: "4px 10px", borderRadius: 20,
                      background: status.done ? "#ECFDF5" : "#FEF3C7",
                      color: status.done ? "#065F46" : "#92400E",
                      textTransform: "uppercase", letterSpacing: "0.04em",
                      flexShrink: 0,
                    }}>
                      {status.done ? "Pagado" : "Pendiente"}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Add task section */}
        {showAddTask ? (
          <div style={{
            background: "white", border: "1.5px solid #E5E7EB",
            borderRadius: 12, padding: 20, marginTop: 8,
            animation: "slideDown 0.3s ease",
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#374151" }}>
              Nueva responsabilidad
            </div>
            <input
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
              placeholder="Nombre del pago o responsabilidad..."
              style={{
                width: "100%", padding: "10px 14px", border: "1.5px solid #E5E7EB",
                borderRadius: 8, fontSize: 14, outline: "none",
                transition: "border-color 0.2s", marginBottom: 10,
                fontFamily: "inherit",
              }}
              onFocus={e => e.target.style.borderColor = "#818CF8"}
              onBlur={e => e.target.style.borderColor = "#E5E7EB"}
              onKeyDown={e => e.key === "Enter" && addTask()}
              autoFocus
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                const colors = CATEGORY_COLORS[key];
                const selected = newTaskCategory === key;
                return (
                  <button key={key} onClick={() => setNewTaskCategory(key)} style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                    border: selected ? `2px solid ${colors.dot}` : "1.5px solid #E5E7EB",
                    background: selected ? colors.bg : "white",
                    color: selected ? colors.text : "#6B7280",
                    transition: "all 0.2s",
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addTask} style={{
                flex: 1, padding: "10px 0", background: "#4338CA",
                color: "white", border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 600, transition: "background 0.2s",
              }}
                onMouseEnter={e => e.target.style.background = "#3730A3"}
                onMouseLeave={e => e.target.style.background = "#4338CA"}
              >Agregar</button>
              <button onClick={() => { setShowAddTask(false); setNewTaskName(""); }} style={{
                padding: "10px 20px", background: "#F3F4F6",
                color: "#6B7280", border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 500, transition: "background 0.2s",
              }}
                onMouseEnter={e => e.target.style.background = "#E5E7EB"}
                onMouseLeave={e => e.target.style.background = "#F3F4F6"}
              >Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddTask(true)} style={{
            width: "100%", padding: "14px",
            border: "2px dashed #D1D5DB", borderRadius: 10,
            background: "transparent", color: "#9CA3AF",
            fontSize: 13, fontWeight: 500, marginTop: 8,
            transition: "all 0.2s", display: "flex",
            alignItems: "center", justifyContent: "center", gap: 6,
          }}
            onMouseEnter={e => { e.target.style.borderColor = "#818CF8"; e.target.style.color = "#4338CA"; }}
            onMouseLeave={e => { e.target.style.borderColor = "#D1D5DB"; e.target.style.color = "#9CA3AF"; }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Agregar responsabilidad
          </button>
        )}

        {/* Bottom actions */}
        <div style={{
          display: "flex", gap: 8, marginTop: 24,
          paddingTop: 20, borderTop: "1px solid #E5E7EB",
        }}>
          <button onClick={() => {
            if (confirm("¿Restablecer todas las tareas de este mes como pendientes?")) {
              resetMonth();
            }
          }} style={{
            flex: 1, padding: "10px 0", background: "white",
            border: "1.5px solid #E5E7EB", borderRadius: 8,
            fontSize: 12, fontWeight: 500, color: "#6B7280",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.target.style.borderColor = "#F87171"; e.target.style.color = "#EF4444"; }}
            onMouseLeave={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.color = "#6B7280"; }}
          >
            ↻ Restablecer mes
          </button>
          <button onClick={() => setCurrentMonth(getCurrentMonthKey())} style={{
            flex: 1, padding: "10px 0",
            background: isCurrentMonth ? "#F3F4F6" : "#4338CA",
            border: "none", borderRadius: 8,
            fontSize: 12, fontWeight: 500,
            color: isCurrentMonth ? "#9CA3AF" : "white",
            transition: "all 0.2s",
            opacity: isCurrentMonth ? 0.6 : 1,
          }}
            disabled={isCurrentMonth}
          >
            ◉ Ir al mes actual
          </button>
        </div>

        {/* Summary footer */}
        <div style={{
          marginTop: 24, padding: "16px 20px",
          background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)",
          borderRadius: 12,
          display: "flex", justifyContent: "space-around",
          textAlign: "center",
        }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#4338CA" }}>{tasks.length}</div>
            <div style={{ fontSize: 11, color: "#6366F1", fontWeight: 500 }}>Total</div>
          </div>
          <div style={{ width: 1, background: "#C7D2FE" }} />
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#059669" }}>{completedCount}</div>
            <div style={{ fontSize: 11, color: "#10B981", fontWeight: 500 }}>Pagados</div>
          </div>
          <div style={{ width: 1, background: "#C7D2FE" }} />
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: pendingCount > 0 ? "#D97706" : "#059669" }}>{pendingCount}</div>
            <div style={{ fontSize: 11, color: pendingCount > 0 ? "#F59E0B" : "#10B981", fontWeight: 500 }}>Pendientes</div>
          </div>
        </div>
      </div>
    </div>
  );
}
