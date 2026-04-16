import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
  Description as DescriptionIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Contact {
  id: string;
  name: string;
  organization?: string;
}

interface User {
  id: string;
  name: string;
}

interface HandoverCategory {
  id: string;
  name: string;
  type: 'EVENT' | 'MEETING';
  description?: string;
  sortOrder: number;
  folders: HandoverFolder[];
}

interface HandoverFolder {
  id: string;
  categoryId: string;
  fiscalYear: number;
  title: string;
  description?: string;
  documents: HandoverDocument[];
}

interface HandoverDocument {
  id: string;
  folderId: string;
  title: string;
  content: string;
  relatedContactIds: string[];
  relatedMemberIds: string[];
  budget?: number;
  venue?: string;
  createdBy: { id: string; name: string };
  updatedBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

const Handover: React.FC = () => {
  const [categories, setCategories] = useState<HandoverCategory[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view');
  
  // ダイアログ状態
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [folderDialog, setFolderDialog] = useState(false);
  const [documentDialog, setDocumentDialog] = useState(false);
  const [documentViewDialog, setDocumentViewDialog] = useState(false);
  
  // フォーム状態
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'EVENT' as 'EVENT' | 'MEETING', description: '' });
  const [folderForm, setFolderForm] = useState({ categoryId: '', fiscalYear: new Date().getFullYear(), title: '', description: '' });
  const [documentForm, setDocumentForm] = useState({
    folderId: '',
    title: '',
    content: '',
    budget: '',
    venue: '',
    relatedContactIds: [] as string[],
    relatedMemberIds: [] as string[],
  });
  const [selectedDocument, setSelectedDocument] = useState<HandoverDocument | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 町民・メンバーデータ
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetchCategories();
    fetchContacts();
    fetchUsers();
  }, []);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/handover/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(response.data);
    } catch (error) {
      console.error('カテゴリ取得エラー:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/contacts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setContacts(response.data);
    } catch (error) {
      console.error('町民データ取得エラー:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
    } catch (error) {
      console.error('ユーザーデータ取得エラー:', error);
    }
  };

  const handleCreateCategory = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/handover/categories`, categoryForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategoryDialog(false);
      setCategoryForm({ name: '', type: 'EVENT', description: '' });
      fetchCategories();
    } catch (error) {
      console.error('カテゴリ作成エラー:', error);
    }
  };

  const handleCreateFolder = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/handover/folders`, folderForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFolderDialog(false);
      setFolderForm({ categoryId: '', fiscalYear: new Date().getFullYear(), title: '', description: '' });
      fetchCategories();
    } catch (error) {
      console.error('フォルダ作成エラー:', error);
    }
  };

  const resetDocumentForm = () => {
    setDocumentForm({
      folderId: '',
      title: '',
      content: '',
      budget: '',
      venue: '',
      relatedContactIds: [],
      relatedMemberIds: [],
    });
    setEditingId(null);
  };

  const handleCreateDocument = async () => {
    try {
      const token = localStorage.getItem('token');
      const data = {
        ...documentForm,
        budget: documentForm.budget ? parseInt(documentForm.budget) : null,
      };
      
      if (editingId) {
        await axios.put(`${API_URL}/api/handover/documents/${editingId}`, data, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(`${API_URL}/api/handover/documents`, data, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      
      setDocumentDialog(false);
      resetDocumentForm();
      fetchCategories();
    } catch (error) {
      console.error('文書作成/更新エラー:', error);
    }
  };

  const handleViewDocument = async (docId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/handover/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedDocument(response.data);
      setDocumentViewDialog(true);
    } catch (error) {
      console.error('文書取得エラー:', error);
    }
  };

  const handleEditDocument = (doc: HandoverDocument) => {
    setEditingId(doc.id);
    setDocumentForm({
      folderId: doc.folderId,
      title: doc.title,
      content: doc.content,
      budget: doc.budget?.toString() || '',
      venue: doc.venue || '',
      relatedContactIds: doc.relatedContactIds || [],
      relatedMemberIds: doc.relatedMemberIds || [],
    });
    setDocumentDialog(true);
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('この文書を削除しますか？')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/handover/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchCategories();
    } catch (error) {
      console.error('文書削除エラー:', error);
    }
  };

  const eventCategories = categories.filter(c => c.type === 'EVENT');
  const meetingCategories = categories.filter(c => c.type === 'MEETING');
  const displayCategories = selectedTab === 0 ? eventCategories : meetingCategories;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">引き継ぎ</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant={viewMode === 'view' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('view')}
          >
            閲覧モード
          </Button>
          <Button
            variant={viewMode === 'edit' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('edit')}
          >
            編集モード
          </Button>
        </Box>
      </Box>

      <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)} sx={{ mb: 3 }}>
        <Tab label="イベント" />
        <Tab label="協力隊MTG" />
      </Tabs>

      {viewMode === 'edit' && (
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setCategoryForm({ ...categoryForm, type: selectedTab === 0 ? 'EVENT' : 'MEETING' });
              setCategoryDialog(true);
            }}
          >
            カテゴリ追加
          </Button>
        </Box>
      )}

      {displayCategories.map((category) => (
        <Accordion key={category.id} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">{category.name}</Typography>
            {category.description && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                {category.description}
              </Typography>
            )}
          </AccordionSummary>
          <AccordionDetails>
            {viewMode === 'edit' && (
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  setFolderForm({ ...folderForm, categoryId: category.id });
                  setFolderDialog(true);
                }}
                sx={{ mb: 2 }}
              >
                年度フォルダ追加
              </Button>
            )}
            
            {category.folders.map((folder) => (
              <Card key={folder.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <FolderIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">
                      {folder.fiscalYear}年度 - {folder.title}
                    </Typography>
                  </Box>
                  
                  {viewMode === 'edit' && (
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        resetDocumentForm();
                        setDocumentForm({ ...documentForm, folderId: folder.id });
                        setDocumentDialog(true);
                      }}
                      sx={{ mb: 2 }}
                    >
                      文書追加
                    </Button>
                  )}

                  {folder.documents.map((doc) => (
                    <Box
                      key={doc.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        border: '1px solid #e0e0e0',
                        borderRadius: 1,
                        mb: 1,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: '#f5f5f5' },
                      }}
                      onClick={() => handleViewDocument(doc.id)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <DescriptionIcon sx={{ mr: 1 }} />
                        <Typography>{doc.title}</Typography>
                        {doc.budget && (
                          <Chip label={`¥${doc.budget.toLocaleString()}`} size="small" color="primary" />
                        )}
                        {doc.venue && (
                          <Chip label={doc.venue} size="small" color="secondary" />
                        )}
                        {doc.relatedContactIds && doc.relatedContactIds.length > 0 && (
                          <Chip 
                            icon={<PersonIcon />}
                            label={`町民${doc.relatedContactIds.length}名`} 
                            size="small" 
                            variant="outlined"
                          />
                        )}
                        {doc.relatedMemberIds && doc.relatedMemberIds.length > 0 && (
                          <Chip 
                            icon={<PersonIcon />}
                            label={`協力隊${doc.relatedMemberIds.length}名`} 
                            size="small" 
                            variant="outlined"
                            color="info"
                          />
                        )}
                      </Box>
                      {viewMode === 'edit' && (
                        <Box onClick={(e) => e.stopPropagation()}>
                          <IconButton size="small" onClick={() => handleEditDocument(doc)}>
                            <EditIcon />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteDocument(doc.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                  ))}
                </CardContent>
              </Card>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}

      {/* カテゴリ作成ダイアログ */}
      <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>カテゴリ追加</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="カテゴリ名"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            fullWidth
            label="説明"
            multiline
            rows={3}
            value={categoryForm.description}
            onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialog(false)}>キャンセル</Button>
          <Button onClick={handleCreateCategory} variant="contained">作成</Button>
        </DialogActions>
      </Dialog>

      {/* フォルダ作成ダイアログ */}
      <Dialog open={folderDialog} onClose={() => setFolderDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>年度フォルダ追加</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="年度"
            type="number"
            value={folderForm.fiscalYear}
            onChange={(e) => setFolderForm({ ...folderForm, fiscalYear: parseInt(e.target.value) })}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            fullWidth
            label="フォルダ名"
            value={folderForm.title}
            onChange={(e) => setFolderForm({ ...folderForm, title: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="説明"
            multiline
            rows={3}
            value={folderForm.description}
            onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderDialog(false)}>キャンセル</Button>
          <Button onClick={handleCreateFolder} variant="contained">作成</Button>
        </DialogActions>
      </Dialog>

      {/* 文書作成/編集ダイアログ */}
      <Dialog open={documentDialog} onClose={() => setDocumentDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? '文書編集' : '文書作成'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="タイトル"
            value={documentForm.title}
            onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            fullWidth
            label="内容"
            multiline
            rows={10}
            value={documentForm.content}
            onChange={(e) => setDocumentForm({ ...documentForm, content: e.target.value })}
            sx={{ mb: 2 }}
            placeholder="準備段階のメモ、議事録、振り返りなどを記入してください"
          />
          <TextField
            fullWidth
            label="予算（円）"
            type="number"
            value={documentForm.budget}
            onChange={(e) => setDocumentForm({ ...documentForm, budget: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="場所"
            value={documentForm.venue}
            onChange={(e) => setDocumentForm({ ...documentForm, venue: e.target.value })}
            sx={{ mb: 2 }}
          />
          <Autocomplete
            multiple
            options={contacts}
            getOptionLabel={(option) => `${option.name}${option.organization ? ` (${option.organization})` : ''}`}
            value={contacts.filter(c => documentForm.relatedContactIds.includes(c.id))}
            onChange={(_, newValue) => {
              setDocumentForm({ ...documentForm, relatedContactIds: newValue.map(v => v.id) });
            }}
            renderInput={(params) => (
              <TextField {...params} label="関わった町民" placeholder="町民を選択" />
            )}
            sx={{ mb: 2 }}
          />
          <Autocomplete
            multiple
            options={users}
            getOptionLabel={(option) => option.name}
            value={users.filter(u => documentForm.relatedMemberIds.includes(u.id))}
            onChange={(_, newValue) => {
              setDocumentForm({ ...documentForm, relatedMemberIds: newValue.map(v => v.id) });
            }}
            renderInput={(params) => (
              <TextField {...params} label="関わった協力隊" placeholder="協力隊を選択" />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDocumentDialog(false);
            resetDocumentForm();
          }}>キャンセル</Button>
          <Button onClick={handleCreateDocument} variant="contained">
            {editingId ? '更新' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 文書閲覧ダイアログ */}
      <Dialog open={documentViewDialog} onClose={() => setDocumentViewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedDocument?.title}</DialogTitle>
        <DialogContent>
          {selectedDocument && (
            <Box>
              <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedDocument.budget && (
                  <Chip label={`予算: ¥${selectedDocument.budget.toLocaleString()}`} color="primary" />
                )}
                {selectedDocument.venue && (
                  <Chip label={`場所: ${selectedDocument.venue}`} color="secondary" />
                )}
              </Box>
              
              {selectedDocument.relatedContactIds && selectedDocument.relatedContactIds.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>関わった町民:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {selectedDocument.relatedContactIds.map(contactId => {
                      const contact = contacts.find(c => c.id === contactId);
                      return contact ? (
                        <Chip 
                          key={contactId} 
                          label={contact.name} 
                          size="small" 
                          variant="outlined"
                        />
                      ) : null;
                    })}
                  </Box>
                </Box>
              )}

              {selectedDocument.relatedMemberIds && selectedDocument.relatedMemberIds.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>関わった協力隊:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {selectedDocument.relatedMemberIds.map(userId => {
                      const user = users.find(u => u.id === userId);
                      return user ? (
                        <Chip 
                          key={userId} 
                          label={user.name} 
                          size="small" 
                          variant="outlined"
                          color="info"
                        />
                      ) : null;
                    })}
                  </Box>
                </Box>
              )}

              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                {selectedDocument.content}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                作成者: {selectedDocument.createdBy.name} | 
                作成日: {new Date(selectedDocument.createdAt).toLocaleDateString('ja-JP')}
                {selectedDocument.updatedBy && (
                  <> | 更新者: {selectedDocument.updatedBy.name}</>
                )}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocumentViewDialog(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Handover;
