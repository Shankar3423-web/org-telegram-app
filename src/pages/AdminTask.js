import React, { useEffect, useState } from "react";
import { ref, push, set, onValue, remove, update } from "firebase/database";
import { database } from "../services/FirebaseConfig";
import { Plus, Pencil, Trash2, X, Save, Zap, LayoutDashboard, Newspaper, FileText, Target, Tag, Layers, Link as LinkIcon, Code } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../Styles/AdminTask.css";

const CATEGORIES = ["normal", "daily", "weekly", "achievements"];
const TYPES = ["news", "game", "watch", "social", "partnership", "misc", "challenge"];
const WEEKLY_MODES = ["single", "tracked"];

export default function AdminTask() {
  const [tasks, setTasks] = useState([]);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    type: "",
    target: 1,
    xp: 0,
    url: "",
    watchCode: "",          // ✅ ADDED
    resetPolicy: "never",
    weeklyMode: "single"
  });

  useEffect(() => {
    const unsub = onValue(ref(database, "tasks"), snap => {
      const data = snap.val() || {};
      const list = Object.entries(data).flatMap(([cat, tasks]) =>
        Object.entries(tasks || {}).map(([id, t]) => ({
          id,
          category: cat,
          ...t
        }))
      );
      setTasks(list);
    });
    return () => unsub();
  }, []);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({
      ...p,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      category: "",
      type: "",
      target: 1,
      xp: 0,
      url: "",
      watchCode: "",        // ✅ RESET
      resetPolicy: "never",
      weeklyMode: "single"
    });
    setEditing(null);
  };

  const handleEdit = task => {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description || "",
      category: task.category,
      type: task.type,
      target: task.target,
      xp: task.xp,
      url: task.url || "",
      watchCode: task.watchCode || "",   // ✅ LOAD
      resetPolicy: task.resetPolicy,
      weeklyMode: task.weeklyMode || "single"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async e => {
    e.preventDefault();

    const payload = {
      title: form.title,
      description: form.description,
      type: form.type,
      target: Number(form.target),
      xp: Number(form.xp),
      url: form.url || "",
      watchCode: form.type === "watch" ? form.watchCode : null, // ✅ STORE ONLY FOR WATCH
      resetPolicy: form.resetPolicy,
      weeklyMode: form.category === "weekly" ? form.weeklyMode : null,
      updatedAt: Date.now()
    };

    try {
      if (editing) {
        await update(ref(database, `tasks/${editing.category}/${editing.id}`), payload);
        toast.success("Task updated");
      } else {
        await set(push(ref(database, `tasks/${form.category}`)), {
          ...payload,
          createdAt: Date.now()
        });
        toast.success("Task created");
      }
      resetForm();
    } catch (e) {
      toast.error("Error saving task");
    }
  };

  const handleDelete = async task => {
    if (!window.confirm("Delete task?")) return;
    await remove(ref(database, `tasks/${task.category}/${task.id}`));
    toast.success("Task deleted");
  };

  return (
    <div className="task-admin-page">
      <ToastContainer position="bottom-right" />

      {/* ---------- ADD / EDIT FORM ---------- */}
      <div className="form-card">
        <h2 className="form-section-title">{editing ? "Edit Task" : "Add Task"}</h2>

        <form onSubmit={handleSubmit} className="form-grid">


          <div className="input-group">
            <label><FileText size={14} className="inline mr-1" /> Task Title</label>
            <input
              name="title"
              placeholder="Enter task title"
              value={form.title}
              onChange={handleChange}
              required
            />
          </div>


          <div className="input-group">
            <label><Layers size={14} className="inline mr-1" /> Description</label>
            <input
              name="description"
              placeholder="Short task description"
              value={form.description}
              onChange={handleChange}
            />
          </div>


          <div className="input-group">
            <label><Tag size={14} className="inline mr-1" /> Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              required
              disabled={!!editing}
            >
              <option value="">Select Category</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>


          <div className="input-group">
            <label><LayoutDashboard size={14} className="inline mr-1" /> Task Type</label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              required
            >
              <option value="">Select Type</option>
              {TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>


          {/* ✅ WATCH-SPECIFIC FIELDS */}
          {form.type === "watch" && (
            <>
              <div className="input-group">
                <label><LinkIcon size={14} className="inline mr-1" /> Video URL</label>
                <input
                  name="url"
                  placeholder="https://..."
                  value={form.url}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="input-group">
                <label><Code size={14} className="inline mr-1" /> Verification Code</label>
                <input
                  name="watchCode"
                  placeholder="Enter verification code"
                  value={form.watchCode}
                  onChange={handleChange}
                  required
                />
              </div>

            </>
          )}

          {form.category === "weekly" && (
            <div className="input-group">
              <label><Layers size={14} className="inline mr-1" /> Weekly Mode</label>
              <select
                name="weeklyMode"
                value={form.weeklyMode}
                onChange={handleChange}
              >
                <option value="single">Single (Once per week)</option>
                <option value="tracked">Tracked (Progress based)</option>
              </select>
            </div>
          )}




          <div className="input-group">
            <label><Target size={14} className="inline mr-1" /> Target</label>
            <input
              type="number"
              name="target"
              value={form.target}
              onChange={handleChange}
            />
          </div>

          <div className="input-group">
            <label><Zap size={14} className="inline mr-1" /> XP Reward</label>
            <input
              type="number"
              name="xp"
              value={form.xp}
              onChange={handleChange}
            />
          </div>



          <div className="form-footer-actions">
            <button type="submit" className="submit-premium-btn">
              {editing ? <Save size={18} /> : <Plus size={18} />}
              <span>{editing ? "Update Task" : "Save Task"}</span>
            </button>
            {editing && (
              <button type="button" className="cancel-premium-btn" onClick={resetForm}>
                <X size={18} /> Cancel
              </button>
            )}
          </div>

        </form>
      </div>

      {/* ---------- TASK TABLE ---------- */}
      <div className="table-section">
        <div className="table-section-header">
          <h2 className="form-section-title"><Layers size={20} /> Existing Tasks</h2>
          <p className="section-subtitle">Manage and monitor all your active tasks here</p>
        </div>
        <div className="table-container">
          <table className="task-table">

            <thead>
              <tr>
                <th width="50">#</th>
                <th>TITLE</th>
                <th>CATEGORY</th>
                <th>TYPE</th>
                <th>XP</th>
                <th width="100">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={t.id}>
                  <td>{i + 1}</td>
                  <td className="font-bold">{t.title}</td>
                  <td>
                    <span className={`badge-premium badge-cat-${t.category}`}>
                      {t.category}
                    </span>
                  </td>
                  <td>
                    <span className={`badge-premium badge-type-${t.type}`}>
                      {t.type}
                    </span>
                  </td>
                  <td>
                    <div className="xp-value">
                      {t.xp} <Zap size={14} fill="#f59e0b" />
                    </div>
                  </td>
                  <td>
                    <div className="action-cell">
                      <button className="btn-icon edit" onClick={() => handleEdit(t)} title="Edit">
                        <Pencil size={16} />
                      </button>
                      <button className="btn-icon delete" onClick={() => handleDelete(t)} title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

