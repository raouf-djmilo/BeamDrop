export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  return `${formatBytes(bytesPerSec, 1)}/s`;
}

export type FileCategory =
  | 'excel'
  | 'powerpoint'
  | 'word'
  | 'pdf'
  | 'archive'
  | 'apk'
  | 'ipa'
  | 'image'
  | 'video'
  | 'audio'
  | 'code'
  | 'document'
  | 'other';

export function getFileCategory(mimeType: string, fileName: string): FileCategory {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // Android Package (APK)
  if (ext === 'apk' || mimeType.includes('vnd.android.package-archive')) {
    return 'apk';
  }

  // iOS App Package (IPA)
  if (ext === 'ipa') {
    return 'ipa';
  }

  // Excel spreadsheets
  if (
    ['xls', 'xlsx', 'csv', 'ods', 'tsv', 'xlsm', 'xltx'].includes(ext) ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType === 'text/csv'
  ) {
    return 'excel';
  }

  // PowerPoint presentations
  if (
    ['ppt', 'pptx', 'pps', 'ppsx', 'odp', 'key', 'pot', 'potx'].includes(ext) ||
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint')
  ) {
    return 'powerpoint';
  }

  // Word documents
  if (
    ['doc', 'docx', 'odt', 'rtf', 'pages', 'dotx'].includes(ext) ||
    mimeType.includes('wordprocessing') ||
    mimeType.includes('msword')
  ) {
    return 'word';
  }

  // PDF
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return 'pdf';
  }

  // Images
  if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'bmp', 'ico', 'tiff'].includes(ext)) {
    return 'image';
  }

  // Videos
  if (mimeType.startsWith('video/') || ['mp4', 'mkv', 'mov', 'webm', 'avi', 'flv', 'wmv', 'm4v'].includes(ext)) {
    return 'video';
  }

  // Audio
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma', 'opus'].includes(ext)) {
    return 'audio';
  }

  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso', 'dmg', 'tgz', 'xz'].includes(ext)) {
    return 'archive';
  }

  // Code
  if (['js', 'ts', 'tsx', 'jsx', 'html', 'css', 'json', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'php', 'sql', 'sh', 'yaml', 'yml', 'xml'].includes(ext)) {
    return 'code';
  }

  // Plain document
  if (['txt', 'md', 'log', 'ini', 'conf'].includes(ext)) {
    return 'document';
  }

  return 'other';
}

export interface FileTypeMeta {
  category: FileCategory;
  extension: string;
  badgeLabel: string;
  colorName: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

export function getFileTypeMeta(mimeType: string, fileName: string): FileTypeMeta {
  const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';
  const category = getFileCategory(mimeType, fileName);

  switch (category) {
    case 'excel':
      return {
        category,
        extension: ext,
        badgeLabel: ext.includes('XLS') || ext === 'CSV' ? ext : 'EXCEL',
        colorName: 'emerald',
        textColor: 'text-emerald-400',
        bgColor: 'bg-emerald-950/70',
        borderColor: 'border-emerald-500/40'
      };
    case 'powerpoint':
      return {
        category,
        extension: ext,
        badgeLabel: ext.includes('PPT') ? ext : 'PPTX',
        colorName: 'amber',
        textColor: 'text-amber-400',
        bgColor: 'bg-amber-950/70',
        borderColor: 'border-amber-500/40'
      };
    case 'word':
      return {
        category,
        extension: ext,
        badgeLabel: ext.includes('DOC') ? ext : 'DOCX',
        colorName: 'blue',
        textColor: 'text-blue-400',
        bgColor: 'bg-blue-950/70',
        borderColor: 'border-blue-500/40'
      };
    case 'pdf':
      return {
        category,
        extension: 'PDF',
        badgeLabel: 'PDF',
        colorName: 'rose',
        textColor: 'text-rose-400',
        bgColor: 'bg-rose-950/70',
        borderColor: 'border-rose-500/40'
      };
    case 'archive':
      return {
        category,
        extension: ext,
        badgeLabel: ext,
        colorName: 'yellow',
        textColor: 'text-yellow-400',
        bgColor: 'bg-yellow-950/70',
        borderColor: 'border-yellow-500/40'
      };
    case 'apk':
      return {
        category,
        extension: 'APK',
        badgeLabel: 'ANDROID APK',
        colorName: 'emerald',
        textColor: 'text-emerald-400',
        bgColor: 'bg-emerald-950/70',
        borderColor: 'border-emerald-500/40'
      };
    case 'ipa':
      return {
        category,
        extension: 'IPA',
        badgeLabel: 'IOS IPA',
        colorName: 'sky',
        textColor: 'text-sky-400',
        bgColor: 'bg-sky-950/70',
        borderColor: 'border-sky-500/40'
      };
    case 'image':
      return {
        category,
        extension: ext,
        badgeLabel: ext,
        colorName: 'teal',
        textColor: 'text-teal-400',
        bgColor: 'bg-teal-950/70',
        borderColor: 'border-teal-500/40'
      };
    case 'video':
      return {
        category,
        extension: ext,
        badgeLabel: ext,
        colorName: 'purple',
        textColor: 'text-purple-400',
        bgColor: 'bg-purple-950/70',
        borderColor: 'border-purple-500/40'
      };
    case 'audio':
      return {
        category,
        extension: ext,
        badgeLabel: ext,
        colorName: 'pink',
        textColor: 'text-pink-400',
        bgColor: 'bg-pink-950/70',
        borderColor: 'border-pink-500/40'
      };
    case 'code':
      return {
        category,
        extension: ext,
        badgeLabel: ext,
        colorName: 'cyan',
        textColor: 'text-cyan-400',
        bgColor: 'bg-cyan-950/70',
        borderColor: 'border-cyan-500/40'
      };
    default:
      return {
        category,
        extension: ext,
        badgeLabel: ext,
        colorName: 'slate',
        textColor: 'text-slate-300',
        bgColor: 'bg-slate-800/70',
        borderColor: 'border-slate-700/60'
      };
  }
}
