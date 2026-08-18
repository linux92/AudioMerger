// vite.config.js
import { defineConfig } from "file:///C:/Users/aj/Desktop/AudioMerger/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/aj/Desktop/AudioMerger/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp"
    }
  },
  // Allow large audio files to be served during development
  assetsInclude: ["**/*.wav", "**/*.mp3", "**/*.ogg", "**/*.m4a", "**/*.flac"]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhalxcXFxEZXNrdG9wXFxcXEF1ZGlvTWVyZ2VyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhalxcXFxEZXNrdG9wXFxcXEF1ZGlvTWVyZ2VyXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9hai9EZXNrdG9wL0F1ZGlvTWVyZ2VyL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcblxuLy8gaHR0cHM6Ly92aXRlLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIHNlcnZlcjoge1xuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDcm9zcy1PcmlnaW4tT3BlbmVyLVBvbGljeSc6ICdzYW1lLW9yaWdpbicsXG4gICAgICAnQ3Jvc3MtT3JpZ2luLUVtYmVkZGVyLVBvbGljeSc6ICdyZXF1aXJlLWNvcnAnLFxuICAgIH0sXG4gIH0sXG4gIC8vIEFsbG93IGxhcmdlIGF1ZGlvIGZpbGVzIHRvIGJlIHNlcnZlZCBkdXJpbmcgZGV2ZWxvcG1lbnRcbiAgYXNzZXRzSW5jbHVkZTogWycqKi8qLndhdicsICcqKi8qLm1wMycsICcqKi8qLm9nZycsICcqKi8qLm00YScsICcqKi8qLmZsYWMnXSxcbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlSLFNBQVMsb0JBQW9CO0FBQ3RULE9BQU8sV0FBVztBQUdsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsUUFBUTtBQUFBLElBQ04sU0FBUztBQUFBLE1BQ1AsOEJBQThCO0FBQUEsTUFDOUIsZ0NBQWdDO0FBQUEsSUFDbEM7QUFBQSxFQUNGO0FBQUE7QUFBQSxFQUVBLGVBQWUsQ0FBQyxZQUFZLFlBQVksWUFBWSxZQUFZLFdBQVc7QUFDN0UsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
