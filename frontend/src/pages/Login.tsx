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

  // テストアカウント一覧を取得（常に表示）
  useEffect(() => {
    fetchLoginHints();
  }, []);

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
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
      case 'SUPPORT':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
      case 'GOVERNMENT':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'MEMBER':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            長沼町地域おこし協力隊
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">ポータルシステム</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
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

        {/* アカウント一覧 */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              利用可能なアカウント一覧
            </h3>
            {loadingHints ? (
              <div className="flex justify-center py-4">
                <LoadingSpinner size="sm" />
              </div>
            ) : loginHints.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        名前
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        メール
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        役割
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        パスワード
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {loginHints.map((hint, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-900 dark:text-gray-100">
                          {hint.name}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-900 dark:text-gray-100 font-mono text-xs">
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
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400 font-mono text-xs">
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
              <p className="text-sm text-gray-500 dark:text-gray-400">アカウントが見つかりませんでした</p>
            )}
          </div>
      </div>
    </div>
  );
};
