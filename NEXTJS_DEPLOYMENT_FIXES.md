# Next.js Render デプロイエラー修正

## 問題と解決策

### 1. autoprefixer 不足エラー

**エラー**: `Error: Cannot find module 'autoprefixer'`

**原因**: `autoprefixer`が`devDependencies`にあるため、本番ビルド時にインストールされない

**解決策**: `package.json`で`autoprefixer`を`dependencies`に移動

```diff
  "dependencies": {
+   "autoprefixer": "^10.4.19",
    "next": "^14.2.0",
    "postcss": "^8.4.38",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwindcss": "^3.4.3"
  },
  "devDependencies": {
-   "autoprefixer": "^10.4.19",
    "@types/node": "^20.12.7",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.5"
  }
```

### 2. @/lib/* @/validations/* module not found

**エラー**: `Module not found: Can't resolve '@/lib/...'` または `Can't resolve '@/validations/...'`

**原因**: TypeScriptの`paths`設定がNext.jsで正しく解決されていない

**解決策**: `tsconfig.json`を修正

```diff
  {
    "compilerOptions": {
      "target": "ES2020",
      "lib": ["dom", "dom.iterable", "esnext"],
      "allowJs": true,
      "skipLibCheck": true,
      "strict": true,
      "noEmit": true,
      "esModuleInterop": true,
      "module": "esnext",
-     "moduleResolution": "node",
+     "moduleResolution": "bundler",
      "resolveJsonModule": true,
      "isolatedModules": true,
      "jsx": "preserve",
      "incremental": true,
      "plugins": [
        {
          "name": "next"
        }
      ],
      "baseUrl": ".",
      "paths": {
-       "@/*": ["./*"]
+       "@/*": ["./src/*"]
      }
    },
    "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    "exclude": ["node_modules"]
  }
```

### 3. tsconfig.json の paths / baseUrl 修正

**問題**: `baseUrl`と`paths`の設定が不適切

**解決策**: Next.js推奨の設定に変更

**完全な`tsconfig.json`**:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 4. ディレクトリ構造の整理

**推奨構造**:

```
project-root/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── ...
│   ├── lib/              # ユーティリティ関数
│   │   ├── prisma.ts
│   │   └── ...
│   ├── validations/      # バリデーションスキーマ
│   │   └── ...
│   └── components/       # Reactコンポーネント
│       └── ...
├── public/
├── next.config.js
├── tsconfig.json
├── postcss.config.js
├── tailwind.config.js
└── package.json
```

**必要なディレクトリを作成**:

```bash
mkdir -p src/lib src/validations
```

### 5. postcss.config.js の確認

**正しい設定**:

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**注意**: CommonJS形式（`module.exports`）を使用すること

### 6. next.config.js の確認

**最小限の設定**:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
};

module.exports = nextConfig;
```

**Prismaを使用する場合**:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
```

## 完全な変更内容（git diff形式）

### package.json

```diff
 {
   "name": "kyoryokutai-frontend",
   "version": "1.0.0",
+  "private": true,
   "scripts": {
-    "dev": "vite --host 0.0.0.0",
-    "build": "tsc && vite build",
-    "preview": "vite preview",
-    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
+    "dev": "next dev",
+    "build": "next build",
+    "start": "next start",
+    "lint": "next lint"
   },
   "dependencies": {
+    "next": "^14.2.0",
+    "autoprefixer": "^10.4.19",
     "@radix-ui/react-dialog": "^1.0.5",
     "@radix-ui/react-dropdown-menu": "^2.0.6",
     "@radix-ui/react-label": "^2.0.2",
     "@radix-ui/react-select": "^2.0.0",
     "@radix-ui/react-slot": "^1.0.2",
     "@radix-ui/react-toast": "^1.1.5",
     "@tanstack/react-query": "^5.90.16",
     "@types/react-beautiful-dnd": "^13.1.8",
     "axios": "^1.13.2",
     "class-variance-authority": "^0.7.0",
     "clsx": "^2.1.1",
     "date-fns": "^3.6.0",
     "lucide-react": "^0.378.0",
+    "postcss": "^8.4.38",
     "react": "^18.3.1",
     "react-beautiful-dnd": "^13.1.1",
     "react-dom": "^18.3.1",
-    "react-router-dom": "^6.23.0",
+    "tailwindcss": "^3.4.3",
     "tailwind-merge": "^2.3.0",
     "zustand": "^4.5.2"
   },
   "devDependencies": {
     "@types/node": "^20.12.7",
     "@types/react": "^18.3.1",
     "@types/react-dom": "^18.3.0",
     "@typescript-eslint/eslint-plugin": "^7.7.0",
     "@typescript-eslint/parser": "^7.7.0",
-    "@vitejs/plugin-react": "^4.2.1",
-    "autoprefixer": "^10.4.19",
     "eslint": "^8.57.0",
-    "eslint-plugin-react-hooks": "^4.6.0",
-    "eslint-plugin-react-refresh": "^0.4.6",
-    "postcss": "^8.4.38",
-    "tailwindcss": "^3.4.3",
     "typescript": "^5.4.5",
-    "vite": "^5.2.10"
   }
 }
```

### tsconfig.json

```diff
 {
   "compilerOptions": {
     "target": "ES2020",
-    "useDefineForClassFields": true,
     "lib": ["ES2020", "DOM", "DOM.Iterable"],
+    "allowJs": true,
     "skipLibCheck": true,
-    "module": "ESNext",
+    "strict": true,
+    "noEmit": true,
+    "esModuleInterop": true,
+    "module": "esnext",
-    "moduleResolution": "bundler",
+    "moduleResolution": "bundler",
     "resolveJsonModule": true,
     "isolatedModules": true,
-    "allowImportingTsExtensions": true,
-    "noEmit": true,
     "jsx": "react-jsx",
+    "jsx": "preserve",
+    "incremental": true,
+    "plugins": [
+      {
+        "name": "next"
+      }
+    ],
     "strict": true,
     "noUnusedLocals": true,
     "noUnusedParameters": true,
     "noFallthroughCasesInSwitch": true,
     "baseUrl": ".",
     "paths": {
       "@/*": ["./src/*"]
     }
   },
-  "include": ["src"],
-  "references": [{ "path": "./tsconfig.node.json" }]
+  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
+  "exclude": ["node_modules"]
 }
```

### postcss.config.js

```diff
-export default {
+module.exports = {
   plugins: {
     tailwindcss: {},
     autoprefixer: {},
   },
 };
```

### next.config.js (新規作成)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
```

## Render設定

### Build Command
```
npm install && npm run build
```

### Start Command
```
npm run start
```

### Environment Variables
- `NODE_ENV=production`
- `DATABASE_URL` (Prisma使用時)
- その他の必要な環境変数

## 確認事項

デプロイ前に以下を確認：

1. ✅ `autoprefixer`が`dependencies`にある
2. ✅ `tsconfig.json`の`paths`が`@/*: ["./src/*"]`になっている
3. ✅ `baseUrl`が`.`に設定されている
4. ✅ `postcss.config.js`がCommonJS形式
5. ✅ `next.config.js`が存在する
6. ✅ `src/lib/`と`src/validations/`ディレクトリが存在する（使用する場合）
7. ✅ `next build`がローカルで成功する

## トラブルシューティング

### エラー: "Cannot find module '@/lib/...'"

**解決策**:
1. `tsconfig.json`の`paths`を確認
2. `src/lib/`ディレクトリが存在するか確認
3. ファイル拡張子（`.ts`または`.tsx`）を確認

### エラー: "autoprefixer not found"

**解決策**:
1. `package.json`で`autoprefixer`が`dependencies`にあるか確認
2. `npm install`を実行
3. `postcss.config.js`が正しい形式か確認

### エラー: "Module resolution failed"

**解決策**:
1. `tsconfig.json`の`moduleResolution`が`bundler`になっているか確認
2. `baseUrl`が`.`に設定されているか確認
3. `paths`の設定を確認

