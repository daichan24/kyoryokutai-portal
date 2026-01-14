import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { api } from '../utils/api';

interface LoginHint {
  name: string;
  email: string;
  role: string;
  password: string;
}

export const Login: React.FC = () => {
  const { login, isAuthenticated, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginHints, setLoginHints] = useState<LoginHint[]>([]);
  const [loadingHints, setLoadingHints] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  
  // 開発環境でのみ表示
  const showTestAccounts = import.meta.env.VITE_SHOW_TEST_ACCOUNTS === 'true';

  // テストアカウント一覧を取得
  useEffect(() => {
    if (showTestAccounts) {
      fetchLoginHints();
    }
  }, [showTestAccounts]);

  const fetchLoginHints = async () => {
    setLoadingHints(true);
    try {
      const response = await api.get<LoginHint[]>('/api/users/login-hints');
      setLoginHints(response.data || []);
    } catch (error) {
      console.error('Failed to fetch login hints:', error);
      // エラーが発生してもログイン画面は表示し続ける
      setLoginHints([]);
    } finally {
      setLoadingHints(false);
    }
  };

  const handleCopyEmail = async (emailToCopy: string) => {
    try {
      await navigator.clipboard.writeText(emailToCopy);
      setCopiedEmail(emailToCopy);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    }
  };

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // roleの色分け
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'MASTER':
        return 'bg-purple-100 text-purple-800';
      case 'SUPPORT':
        return 'bg-orange-100 text-orange-800';
      case 'GOVERNMENT':
        return 'bg-blue-100 text-blue-800';
      case 'MEMBER':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            長沼町地域おこし協力隊
          </h2>
          <p className="mt-2 text-sm text-gray-600">ポータルシステム</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <Input
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="example@test.com"
          />

          <Input
            label="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? <LoadingSpinner size="sm" /> : 'ログイン'}
          </Button>

        </form>

        {/* テストアカウント一覧（開発環境のみ） */}
        {showTestAccounts && (
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              テストアカウント一覧
            </h3>
            {loadingHints ? (
              <div className="flex justify-center py-4">
                <LoadingSpinner size="sm" />
              </div>
            ) : loginHints.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        名前
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        メール
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        役割
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        パスワード
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loginHints.map((hint, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                          {hint.name}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-900 font-mono text-xs">
                          {hint.email}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs rounded-full font-medium ${getRoleColor(
                              hint.role
                            )}`}
                          >
                            {hint.role}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 font-mono text-xs">
                          {hint.password}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <button
                            onClick={() => handleCopyEmail(hint.email)}
                            className="text-primary hover:text-blue-600 transition-colors"
                            title="メールアドレスをコピー"
                          >
                            {copiedEmail === hint.email ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">テストアカウントが見つかりませんでした</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
