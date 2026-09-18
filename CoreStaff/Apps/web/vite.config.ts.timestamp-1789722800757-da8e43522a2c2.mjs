// vite.config.ts
import { defineConfig, loadEnv } from "file:///D:/MONHOCKI8/Project/CoreStaff/Apps/web/node_modules/vite/dist/node/index.js";
import tailwindcss from "file:///D:/MONHOCKI8/Project/CoreStaff/Apps/web/node_modules/@tailwindcss/vite/dist/index.mjs";
import react from "file:///D:/MONHOCKI8/Project/CoreStaff/Apps/web/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "node:path";
var __vite_injected_original_dirname = "D:\\MONHOCKI8\\Project\\CoreStaff\\Apps\\web";
function authProxy(target, local = false) {
  return {
    target,
    changeOrigin: true,
    cookieDomainRewrite: "",
    cookiePathRewrite: local ? "/local-api" : "/api",
    ...local ? { rewrite: (url) => url.replace(/^\/local-api/, "") } : {},
    configure(proxy) {
      proxy.on("proxyRes", (response) => {
        const cookies = response.headers["set-cookie"];
        if (cookies) {
          response.headers["set-cookie"] = cookies.map((cookie) => cookie.replace(/;\s*Secure\b/gi, "").replace(/;\s*SameSite=[^;]*/gi, "") + "; SameSite=Lax");
        }
      });
    }
  };
}
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, __vite_injected_original_dirname, "VITE_");
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      }
    },
    server: {
      port: 5173,
      proxy: {
        "/api": authProxy(env.VITE_API_URL || "https://18-141-68-40.sslip.io"),
        "/local-api": authProxy(env.VITE_API_FALLBACK_URL || "http://localhost:3000", true)
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxNT05IT0NLSThcXFxcUHJvamVjdFxcXFxDb3JlU3RhZmZcXFxcQXBwc1xcXFx3ZWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXE1PTkhPQ0tJOFxcXFxQcm9qZWN0XFxcXENvcmVTdGFmZlxcXFxBcHBzXFxcXHdlYlxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovTU9OSE9DS0k4L1Byb2plY3QvQ29yZVN0YWZmL0FwcHMvd2ViL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52LCB0eXBlIFByb3h5T3B0aW9ucyB9IGZyb20gJ3ZpdGUnO1xyXG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAnQHRhaWx3aW5kY3NzL3ZpdGUnO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xyXG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xyXG5cclxuLy8gVGhlIGJyb3dzZXIgdGFsa3MgdG8gVml0ZSBzbyBzaWQgaXMgYSBmaXJzdC1wYXJ0eSBjb29raWUsIGluY2x1ZGluZyB3aGVuXHJcbi8vIHRoZSB1cHN0cmVhbSBzdGlsbCBpc3N1ZXMgU2FtZVNpdGU9TGF4IGNvb2tpZXMuXHJcbmZ1bmN0aW9uIGF1dGhQcm94eSh0YXJnZXQ6IHN0cmluZywgbG9jYWwgPSBmYWxzZSk6IFByb3h5T3B0aW9ucyB7XHJcbiAgcmV0dXJuIHtcclxuICAgIHRhcmdldCxcclxuICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgIGNvb2tpZURvbWFpblJld3JpdGU6ICcnLFxyXG4gICAgY29va2llUGF0aFJld3JpdGU6IGxvY2FsID8gJy9sb2NhbC1hcGknIDogJy9hcGknLFxyXG4gICAgLi4uKGxvY2FsID8geyByZXdyaXRlOiAodXJsOiBzdHJpbmcpID0+IHVybC5yZXBsYWNlKC9eXFwvbG9jYWwtYXBpLywgJycpIH0gOiB7fSksXHJcbiAgICBjb25maWd1cmUocHJveHkpIHtcclxuICAgICAgcHJveHkub24oJ3Byb3h5UmVzJywgKHJlc3BvbnNlKSA9PiB7XHJcbiAgICAgICAgY29uc3QgY29va2llcyA9IHJlc3BvbnNlLmhlYWRlcnNbJ3NldC1jb29raWUnXTtcclxuICAgICAgICBpZiAoY29va2llcykge1xyXG4gICAgICAgICAgLy8gT25seSB0aGUgbG9jYWwgSFRUUCBkZXYgcHJveHkgbmVlZHMgdGhpcyBub3JtYWxpemF0aW9uLlxyXG4gICAgICAgICAgcmVzcG9uc2UuaGVhZGVyc1snc2V0LWNvb2tpZSddID0gY29va2llcy5tYXAoKGNvb2tpZSkgPT4gY29va2llXHJcbiAgICAgICAgICAgIC5yZXBsYWNlKC87XFxzKlNlY3VyZVxcYi9naSwgJycpXHJcbiAgICAgICAgICAgIC5yZXBsYWNlKC87XFxzKlNhbWVTaXRlPVteO10qL2dpLCAnJykgKyAnOyBTYW1lU2l0ZT1MYXgnKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSxcclxuICB9O1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XHJcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBfX2Rpcm5hbWUsICdWSVRFXycpO1xyXG4gIHJldHVybiB7XHJcbiAgcGx1Z2luczogW3JlYWN0KCksIHRhaWx3aW5kY3NzKCldLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBwb3J0OiA1MTczLFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgJy9hcGknOiBhdXRoUHJveHkoZW52LlZJVEVfQVBJX1VSTCB8fCAnaHR0cHM6Ly8xOC0xNDEtNjgtNDAuc3NsaXAuaW8nKSxcclxuICAgICAgJy9sb2NhbC1hcGknOiBhdXRoUHJveHkoZW52LlZJVEVfQVBJX0ZBTExCQUNLX1VSTCB8fCAnaHR0cDovL2xvY2FsaG9zdDozMDAwJywgdHJ1ZSksXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgfTtcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbVQsU0FBUyxjQUFjLGVBQWtDO0FBQzVXLE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFIakIsSUFBTSxtQ0FBbUM7QUFPekMsU0FBUyxVQUFVLFFBQWdCLFFBQVEsT0FBcUI7QUFDOUQsU0FBTztBQUFBLElBQ0w7QUFBQSxJQUNBLGNBQWM7QUFBQSxJQUNkLHFCQUFxQjtBQUFBLElBQ3JCLG1CQUFtQixRQUFRLGVBQWU7QUFBQSxJQUMxQyxHQUFJLFFBQVEsRUFBRSxTQUFTLENBQUMsUUFBZ0IsSUFBSSxRQUFRLGdCQUFnQixFQUFFLEVBQUUsSUFBSSxDQUFDO0FBQUEsSUFDN0UsVUFBVSxPQUFPO0FBQ2YsWUFBTSxHQUFHLFlBQVksQ0FBQyxhQUFhO0FBQ2pDLGNBQU0sVUFBVSxTQUFTLFFBQVEsWUFBWTtBQUM3QyxZQUFJLFNBQVM7QUFFWCxtQkFBUyxRQUFRLFlBQVksSUFBSSxRQUFRLElBQUksQ0FBQyxXQUFXLE9BQ3RELFFBQVEsa0JBQWtCLEVBQUUsRUFDNUIsUUFBUSx3QkFBd0IsRUFBRSxJQUFJLGdCQUFnQjtBQUFBLFFBQzNEO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFDRjtBQUVBLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFFBQU0sTUFBTSxRQUFRLE1BQU0sa0NBQVcsT0FBTztBQUM1QyxTQUFPO0FBQUEsSUFDUCxTQUFTLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQztBQUFBLElBQ2hDLFNBQVM7QUFBQSxNQUNQLE9BQU87QUFBQSxRQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxNQUN0QztBQUFBLElBQ0Y7QUFBQSxJQUNBLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxRQUNMLFFBQVEsVUFBVSxJQUFJLGdCQUFnQiwrQkFBK0I7QUFBQSxRQUNyRSxjQUFjLFVBQVUsSUFBSSx5QkFBeUIseUJBQXlCLElBQUk7QUFBQSxNQUNwRjtBQUFBLElBQ0Y7QUFBQSxFQUNBO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
