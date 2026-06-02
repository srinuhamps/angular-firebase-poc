export interface MediaItem {
  id: string;
  title: string;
  url: string;         // public download URL
  storagePath: string; // Firebase Storage path for deletion
  createdAt: number;   // epoch ms
}
