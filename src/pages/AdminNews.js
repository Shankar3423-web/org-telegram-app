import React, { useState, useEffect } from 'react';
import {
  ref,
  push,
  set,
  update,
  onValue,
  remove,
  serverTimestamp,
  get,
  query,
  orderByChild
} from 'firebase/database';
import { database } from "../services/FirebaseConfig";
import { Pencil, Trash2, Plus, Save, X, ExternalLink, Newspaper, ThumbsUp } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import "../Styles/AdminNews.css";

const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const AdminNews = () => {
  const [newsList, setNewsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [currentNews, setCurrentNews] = useState({
    title: '',
    summary: '',
    category: '',
    imageUrl: '',
    readMoreLink: '',
  });
  const [editingNewsId, setEditingNewsId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteNewsId, setDeleteNewsId] = useState(null);
  const [deleteNewsTitle, setDeleteNewsTitle] = useState('');

  useEffect(() => {
    const newsRef = query(ref(database, 'news'), orderByChild('createdAt'));
    const unsubscribe = onValue(
      newsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const newsArray = Object.entries(data)
            .map(([id, item]) => ({ id, ...item }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setNewsList(newsArray);
        } else {
          setNewsList([]);
        }
        setIsLoading(false);
      },
      (error) => {
        toast.error(`Error loading news: ${error.message}`);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setModalMode('add');
    setCurrentNews({
      title: '',
      summary: '',
      category: '',
      imageUrl: '',
      readMoreLink: '',
    });
    setEditingNewsId(null);
    setNewsModalOpen(true);
  };

  const openEditModal = async (newsId) => {
    try {
      const snapshot = await get(ref(database, `news/${newsId}`));
      const newsItem = snapshot.val();
      if (newsItem) {
        setCurrentNews({
          title: newsItem.title || '',
          summary: newsItem.summary || '',
          category: newsItem.category || '',
          imageUrl: newsItem.imageUrl || '',
          readMoreLink: newsItem.readMoreLink || '',
        });
        setEditingNewsId(newsId);
        setModalMode('edit');
        setNewsModalOpen(true);
      } else {
        toast.error('News item not found');
      }
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const openDeleteModal = (newsId, title) => {
    setDeleteNewsId(newsId);
    setDeleteNewsTitle(title);
    setDeleteModalOpen(true);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    const trimmedTitle = currentNews.title.trim();
    const trimmedSummary = currentNews.summary.trim();
    const trimmedCategory = currentNews.category.trim();
    const trimmedImageUrl = currentNews.imageUrl.trim();
    const trimmedReadMoreLink = currentNews.readMoreLink.trim();

    if (!trimmedTitle || !trimmedSummary || !trimmedCategory) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (modalMode === 'edit' && editingNewsId) {
        await update(ref(database, `news/${editingNewsId}`), {
          title: trimmedTitle,
          summary: trimmedSummary,
          category: trimmedCategory,
          imageUrl: trimmedImageUrl,
          readMoreLink: trimmedReadMoreLink,
          updatedAt: serverTimestamp()
        });
        toast.success('News updated successfully');
      } else {
        const newNewsRef = push(ref(database, 'news'));
        await set(newNewsRef, {
          title: trimmedTitle,
          summary: trimmedSummary,
          category: trimmedCategory,
          imageUrl: trimmedImageUrl,
          readMoreLink: trimmedReadMoreLink,
          createdAt: serverTimestamp()
        });
        toast.success(`News "${trimmedTitle}" added successfully`);
      }
      setNewsModalOpen(false);
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await remove(ref(database, `news/${deleteNewsId}`));
      toast.success('News deleted successfully');
      setDeleteModalOpen(false);
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    }
  };

  return (
    <div className="news-manager">
      <ToastContainer position="bottom-right" theme="colored" />
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Newspaper size={28} color="#6366f1" />
          <h1>News Manager</h1>
        </div>
        <button className="add-news-btn" onClick={openAddModal}>
          <Plus size={18} /> Add News
        </button>
      </header>

      <section className="news-list-section">
        {isLoading ? (
          <div className="loading">Loading news...</div>
        ) : newsList.length > 0 ? (
          <table className="news-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title & Summary</th>
                <th>Category</th>
                <th>Likes</th>
                <th>Links</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {newsList.map((newsItem, index) => (
                <tr key={newsItem.id}>
                  <td style={{ fontWeight: '600', color: '#9ca3af' }}>{index + 1}</td>
                  <td>
                    <div style={{ fontWeight: '600', color: '#111827' }}>{newsItem.title}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      {newsItem.summary.length > 100 ? newsItem.summary.substring(0, 100) + '...' : newsItem.summary}
                    </div>
                  </td>
                  <td><span className="badge badge-cat">{newsItem.category}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                      <ThumbsUp size={14} color="#3b82f6" />
                      <span style={{ fontWeight: '600' }}>{newsItem.likes || 0}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {newsItem.imageUrl && (
                        <a href={newsItem.imageUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                          <ExternalLink size={12} /> Image
                        </a>
                      )}
                      {newsItem.readMoreLink && (
                        <a href={newsItem.readMoreLink} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                          <ExternalLink size={12} /> Read More
                        </a>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: '12px', color: '#6b7280' }}>{formatDate(newsItem.createdAt)}</td>
                  <td>
                    <div className="actions-cell">
                      <button className="edit-btn" onClick={() => openEditModal(newsItem.id)} title="Edit News">
                        <Pencil size={16} color="#6366f1" />
                      </button>
                      <button className="delete-btn" onClick={() => openDeleteModal(newsItem.id, newsItem.title)} title="Delete News">
                        <Trash2 size={16} color="#ef4444" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">No news items available. Start by adding one!</div>
        )}
      </section>

      {/* Modal for Add/Edit News */}
      {newsModalOpen && (
        <div className="modal-overlay" onClick={() => setNewsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'edit' ? 'Edit News' : 'Add New News'}</h2>
              <button className="modal-close" onClick={() => setNewsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleModalSubmit}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  placeholder="Enter title"
                  value={currentNews.title}
                  onChange={(e) => setCurrentNews({ ...currentNews, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Summary</label>
                <input
                  placeholder="Enter brief summary"
                  value={currentNews.summary}
                  onChange={(e) => setCurrentNews({ ...currentNews, summary: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  placeholder="e.g. Technology, Update"
                  value={currentNews.category}
                  onChange={(e) => setCurrentNews({ ...currentNews, category: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Image URL</label>
                <input
                  type="text"
                  placeholder="https://example.com/image.jpg"
                  value={currentNews.imageUrl}
                  onChange={(e) => setCurrentNews({ ...currentNews, imageUrl: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Read More URL</label>
                <input
                  type="text"
                  placeholder="https://example.com/full-article"
                  value={currentNews.readMoreLink}
                  onChange={(e) => setCurrentNews({ ...currentNews, readMoreLink: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setNewsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" style={{ padding: '10px 24px' }}>
                  {modalMode === 'edit' ? <><Save size={18} /> Update</> : <><Plus size={18} /> Add</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Delete Confirmation */}
      {deleteModalOpen && (
        <div className="modal-overlay" onClick={() => setDeleteModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="modal-close" onClick={() => setDeleteModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <br /><strong>{deleteNewsTitle}</strong>?</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="cancel-btn" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="submit-btn delete-btn" style={{ background: '#ef4444' }} onClick={handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNews;
