const fs = require('fs');
const path = require('path');

const replacements = {
  'text-zinc-900': 'text-on-surface',
  'text-zinc-800': 'text-on-surface',
  'text-zinc-700': 'text-on-surface',
  'text-zinc-600': 'text-on-surface-variant',
  'text-zinc-500': 'text-on-surface-variant',
  'text-zinc-400': 'text-outline-variant',
  'text-zinc-300': 'text-outline-variant',
  'text-zinc-200': 'text-outline-variant',
  'text-zinc-100': 'text-outline-variant',
  'text-zinc-50': 'text-outline-variant',
  'bg-zinc-900': 'bg-surface-dim',
  'bg-zinc-800': 'bg-surface-dim',
  'bg-zinc-700': 'bg-surface-dim',
  'bg-zinc-600': 'bg-surface-container-highest',
  'bg-zinc-500': 'bg-surface-container-highest',
  'bg-zinc-400': 'bg-surface-container-high',
  'bg-zinc-300': 'bg-surface-container-high',
  'bg-zinc-200': 'bg-surface-container',
  'bg-zinc-100': 'bg-surface-container-low',
  'bg-zinc-50': 'bg-surface-container-lowest',
  'border-zinc-900': 'border-outline',
  'border-zinc-800': 'border-outline',
  'border-zinc-700': 'border-outline',
  'border-zinc-600': 'border-outline',
  'border-zinc-500': 'border-outline',
  'border-zinc-400': 'border-outline-variant',
  'border-zinc-300': 'border-outline-variant',
  'border-zinc-200': 'border-outline-variant',
  'border-zinc-100': 'border-outline-variant',
  'border-zinc-50': 'border-outline-variant',
  'text-gray-900': 'text-on-surface',
  'text-gray-800': 'text-on-surface',
  'text-gray-700': 'text-on-surface',
  'text-gray-600': 'text-on-surface-variant',
  'text-gray-500': 'text-on-surface-variant',
  'text-gray-400': 'text-outline-variant',
  'text-gray-300': 'text-outline-variant',
  'text-gray-200': 'text-outline-variant',
  'text-gray-100': 'text-outline-variant',
  'text-gray-50': 'text-outline-variant',
  'bg-gray-900': 'bg-surface-dim',
  'bg-gray-800': 'bg-surface-dim',
  'bg-gray-700': 'bg-surface-dim',
  'bg-gray-600': 'bg-surface-container-highest',
  'bg-gray-500': 'bg-surface-container-highest',
  'bg-gray-400': 'bg-surface-container-high',
  'bg-gray-300': 'bg-surface-container-high',
  'bg-gray-200': 'bg-surface-container',
  'bg-gray-100': 'bg-surface-container-low',
  'bg-gray-50': 'bg-surface-container-lowest',
  'border-gray-900': 'border-outline',
  'border-gray-800': 'border-outline',
  'border-gray-700': 'border-outline',
  'border-gray-600': 'border-outline',
  'border-gray-500': 'border-outline',
  'border-gray-400': 'border-outline-variant',
  'border-gray-300': 'border-outline-variant',
  'border-gray-200': 'border-outline-variant',
  'border-gray-100': 'border-outline-variant',
  'border-gray-50': 'border-outline-variant',
  'text-blue-600': 'text-primary',
  'bg-blue-600': 'bg-primary',
  'border-blue-600': 'border-primary',
  'text-blue-500': 'text-primary',
  'bg-blue-500': 'bg-primary',
  'border-blue-500': 'border-primary',
  'bg-blue-50': 'bg-primary/10',
  'bg-blue-100': 'bg-primary/20',
  'text-blue-400': 'text-primary/60',
  'border-blue-400': 'border-primary/50',
  'bg-black': 'bg-surface-dim',
  'text-black': 'text-on-surface',
  'bg-white': 'bg-surface',
  'border-white': 'border-surface',
};

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const [oldVal, newVal] of Object.entries(replacements)) {
        if (content.includes(oldVal)) {
          // Use regex to replace whole words only to avoid partial matches if any, but simple replaceAll is fine for these tailwind classes
          const regex = new RegExp(`\\b${oldVal}\\b`, 'g');
          content = content.replace(regex, newVal);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src'));
