import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

// 1. src/app/api 以下の置換
const targetDir1 = path.resolve('src/app/api');
walkDir(targetDir1, (filePath) => {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('verifyFirebaseIdToken')) {
    content = content.replace(/@\/lib\/firebase\/auth-verify/g, '@/lib/supabase/auth-verify');
    content = content.replace(/verifyFirebaseIdToken/g, 'verifySupabaseAccessToken');
    content = content.replace(/verifySupabaseAccessToken\(\s*([a-zA-Z0-9_]+)\s*,\s*[^)]+\)/g, 'verifySupabaseAccessToken($1)');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated API: ${filePath}`);
  }
});

// 2. tests/ 以下の置換 (テストコードのモック対応)
const targetDir2 = path.resolve('tests');
walkDir(targetDir2, (filePath) => {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  if (content.includes('verifyFirebaseIdToken')) {
    content = content.replace(/@\/lib\/firebase\/auth-verify/g, '@/lib/supabase/auth-verify');
    content = content.replace(/verifyFirebaseIdToken/g, 'verifySupabaseAccessToken');
    changed = true;
  }
  
  if (content.includes('verifyFirebaseIdToken')) {
    content = content.replace(/verifyFirebaseIdToken/g, 'verifySupabaseAccessToken');
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated Test: ${filePath}`);
  }
});
