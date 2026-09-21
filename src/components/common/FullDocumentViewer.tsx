import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  RotateCw,
  FileText,
  AlertCircle,
  Loader2,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface FullDocumentViewerProps {
  content: string; // HTML string, PDF data/file URL, Image URL, or raw text
  title?: string;
  categoryName?: string;
  subTabName?: string;
  className?: string;
  onOpenFullScreen?: () => void;
}

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

// Convert base64 data URI to Uint8Array for reliable PDF.js parsing
function convertDataURIToBinary(dataURI: string): Uint8Array {
  const base64Index = dataURI.indexOf(';base64,');
  if (base64Index !== -1) {
    const raw = window.atob(dataURI.substring(base64Index + 8));
    const rawLength = raw.length;
    const array = new Uint8Array(new ArrayBuffer(rawLength));
    for (let i = 0; i < rawLength; i++) {
      array[i] = raw.charCodeAt(i);
    }
    return array;
  }
  return new TextEncoder().encode(dataURI);
}

export const FullDocumentViewer: React.FC<FullDocumentViewerProps> = ({
  content,
  title = 'Document',
  categoryName = '',
  subTabName = '',
  className = '',
  onOpenFullScreen,
}) => {
  // Document type detection
  const isPdf =
    Boolean(content) &&
    (content.startsWith('data:application/pdf') ||
      content.endsWith('.pdf') ||
      content.includes('.pdf?') ||
      content.startsWith('blob:') ||
      content.startsWith('http') && content.toLowerCase().includes('pdf'));

  const isImage =
    Boolean(content) &&
    (content.startsWith('data:image/') ||
      /\.(png|jpe?g|svg|webp|gif)$/i.test(content.split('?')[0]));

  const isHtml =
    !isPdf &&
    !isImage &&
    Boolean(content) &&
    (content.trim().startsWith('<') ||
      content.includes('<html') ||
      content.includes('<div') ||
      content.includes('<style') ||
      content.includes('<script') ||
      content.includes('<svg') ||
      content.includes('<table') ||
      content.includes('<iframe') ||
      content.includes('<!DOCTYPE') ||
      content.startsWith('data:text/html'));

  // --- HTML AUTO-HEIGHT LOGIC (Show whole HTML document, scroll the whole site) ---
  const [htmlHeight, setHtmlHeight] = useState<number>(850);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameId = useRef<string>(`doc_frame_${Math.random().toString(36).substring(2, 9)}`);

  // Prepare sanitized HTML with height-reporter script and zero internal scrollbar CSS
  const preparedHtml = useMemo(() => {
    if (!isHtml) return '';

    let raw = content;
    if (raw.startsWith('data:text/html;base64,')) {
      try {
        raw = decodeURIComponent(escape(window.atob(raw.replace('data:text/html;base64,', ''))));
      } catch (_) {}
    } else if (raw.startsWith('data:text/html,')) {
      raw = decodeURIComponent(raw.replace('data:text/html,', ''));
    }

    const injection = `
      <style id="site-full-doc-override">
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          overflow-y: hidden !important;
          overflow-x: auto !important;
          height: auto !important;
          min-height: 100% !important;
        }
      </style>
      <script>
        (function() {
          function reportHeight() {
            var body = document.body;
            var html = document.documentElement;
            if (!body || !html) return;
            var h = Math.max(
              body.scrollHeight || 0,
              html.scrollHeight || 0,
              body.offsetHeight || 0,
              html.offsetHeight || 0,
              body.clientHeight || 0,
              html.clientHeight || 0
            );
            window.parent.postMessage({ type: 'FULL_DOC_RESIZE', frameId: '${frameId.current}', height: h }, '*');
          }
          window.addEventListener('load', reportHeight);
          window.addEventListener('resize', reportHeight);
          setTimeout(reportHeight, 150);
          setTimeout(reportHeight, 600);
          setTimeout(reportHeight, 1800);
          setTimeout(reportHeight, 4000);
          if (window.MutationObserver) {
            var observer = new MutationObserver(reportHeight);
            observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
          }
        })();
      </script>
    `;

    if (raw.includes('</body>')) {
      return raw.replace('</body>', `${injection}</body>`);
    } else if (raw.includes('</html>')) {
      return raw.replace('</html>', `${injection}</html>`);
    }
    return `${raw}${injection}`;
  }, [content, isHtml]);

  // Listen to height message from the iframe
  useEffect(() => {
    if (!isHtml) return;

    const handleMessage = (e: MessageEvent) => {
      if (
        e.data &&
        e.data.type === 'FULL_DOC_RESIZE' &&
        e.data.frameId === frameId.current &&
        typeof e.data.height === 'number'
      ) {
        const calculated = Math.max(e.data.height + 30, 600);
        setHtmlHeight(calculated);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isHtml]);

  // Fallback direct measurement
  const handleIframeLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
      if (doc) {
        const h = Math.max(
          doc.body?.scrollHeight || 0,
          doc.documentElement?.scrollHeight || 0,
          doc.body?.offsetHeight || 0,
          doc.documentElement?.offsetHeight || 0
        );
        if (h > 0) {
          setHtmlHeight(Math.max(h + 30, 600));
        }
      }
    } catch (_) {}
  };

  // --- PDF MULTI-PAGE SEQUENTIAL CANVAS RENDERING ---
  // (Renders all PDF pages vertically at full height with NO internal scrolling)
  const [pdfNumPages, setPdfNumPages] = useState<number>(0);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfZoom, setPdfZoom] = useState<number>(1.25);
  const [useNativePdfViewer, setUseNativePdfViewer] = useState<boolean>(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const renderPdfPages = useCallback(async () => {
    if (!isPdf || useNativePdfViewer) return;

    if (!window.pdfjsLib) {
      // PDF.js not loaded, fallback to native viewer
      setUseNativePdfViewer(true);
      return;
    }

    setPdfLoading(true);
    setPdfError(null);

    try {
      let loadingTask: any;
      if (content.startsWith('data:application/pdf')) {
        const binary = convertDataURIToBinary(content);
        loadingTask = window.pdfjsLib.getDocument({ data: binary });
      } else {
        loadingTask = window.pdfjsLib.getDocument(content);
      }

      const pdf = await loadingTask.promise;
      setPdfNumPages(pdf.numPages);

      if (pdfContainerRef.current) {
        pdfContainerRef.current.innerHTML = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: pdfZoom });

          // Wrapper for this page
          const pageWrapper = document.createElement('div');
          pageWrapper.className =
            'pdf-page-card bg-white shadow-xl rounded-xl overflow-hidden my-5 mx-auto max-w-5xl border border-slate-300 relative';

          // Page header pill
          const pageHeader = document.createElement('div');
          pageHeader.className =
            'bg-slate-100 text-slate-600 text-[11px] font-bold px-4 py-1.5 border-b border-slate-200 flex items-center justify-between';
          pageHeader.innerHTML = `<span>Page ${pageNum} of ${pdf.numPages}</span><span class="text-slate-400 text-[10px] uppercase font-mono">${title}</span>`;
          pageWrapper.appendChild(pageHeader);

          // Canvas element
          const canvas = document.createElement('canvas');
          canvas.className = 'w-full h-auto block';
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };

          await page.render(renderContext).promise;
          pageWrapper.appendChild(canvas);
          pdfContainerRef.current.appendChild(pageWrapper);
        }
      }
      setPdfLoading(false);
    } catch (err: any) {
      console.warn('PDF.js render error, falling back to iframe:', err);
      setPdfError(err?.message || 'Could not render PDF pages with canvas');
      setPdfLoading(false);
      setUseNativePdfViewer(true);
    }
  }, [content, isPdf, pdfZoom, title, useNativePdfViewer]);

  useEffect(() => {
    if (isPdf && !useNativePdfViewer) {
      renderPdfPages();
    }
  }, [isPdf, renderPdfPages, useNativePdfViewer]);

  return (
    <div className={`w-full flex flex-col ${className}`}>
      {/* 1. HTML Rendering: Auto-height iframe that displays the whole thing and scrolls the site */}
      {isHtml && (
        <div className="w-full bg-white rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden">
          <iframe
            ref={iframeRef}
            srcDoc={preparedHtml}
            title={title}
            onLoad={handleIframeLoad}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
            scrolling="no"
            style={{
              height: `${htmlHeight}px`,
              width: '100%',
              border: 'none',
              display: 'block',
              overflow: 'hidden',
            }}
            className="w-full bg-white transition-all duration-300"
          />
        </div>
      )}

      {/* 2. PDF Rendering: Sequential multi-page canvas (No scroll inside document, site scrolls naturally) */}
      {isPdf && !useNativePdfViewer && (
        <div className="w-full space-y-4">
          {/* PDF Page Controls Bar */}
          <div className="bg-slate-900/90 border border-slate-700/80 px-4 py-2.5 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs shadow-md">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>PDF Document</span>
              </span>
              {pdfNumPages > 0 && (
                <span className="text-slate-300 font-medium">
                  {pdfNumPages} {pdfNumPages === 1 ? 'Page' : 'Pages'} (Continuous Scroll)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom Out */}
              <button
                type="button"
                onClick={() => setPdfZoom((prev) => Math.max(0.8, prev - 0.2))}
                title="Zoom Out"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 cursor-pointer active:scale-95"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-slate-400 font-mono text-[11px] min-w-[38px] text-center">
                {Math.round(pdfZoom * 100)}%
              </span>
              {/* Zoom In */}
              <button
                type="button"
                onClick={() => setPdfZoom((prev) => Math.min(2.5, prev + 0.2))}
                title="Zoom In"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 cursor-pointer active:scale-95"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              {/* Toggle to native browser viewer if preferred */}
              <button
                type="button"
                onClick={() => setUseNativePdfViewer(true)}
                title="Switch to browser's embedded PDF viewer"
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-slate-100 rounded-lg border border-slate-700 text-[11px] font-bold cursor-pointer transition-colors"
              >
                Native Viewer
              </button>

              {onOpenFullScreen && (
                <button
                  type="button"
                  onClick={onOpenFullScreen}
                  title="Fullscreen"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-slate-700 cursor-pointer active:scale-95"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Loading Indicator */}
          {pdfLoading && (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs text-slate-400 font-medium">
                Rendering all pages at full resolution for seamless page scrolling...
              </p>
            </div>
          )}

          {/* Rendered Canvas Pages Feed */}
          <div ref={pdfContainerRef} className="w-full flex flex-col items-center" />
        </div>
      )}

      {/* 2b. PDF Native Viewer Fallback (Expanded height) */}
      {isPdf && useNativePdfViewer && (
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800 rounded-xl border border-slate-700 text-xs">
            <span className="text-slate-300">Browser Native PDF Viewer</span>
            <button
              type="button"
              onClick={() => setUseNativePdfViewer(false)}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer"
            >
              Back to Full Page Continuous View
            </button>
          </div>
          <iframe
            src={content}
            title={title}
            className="w-full min-h-[1200px] rounded-2xl border border-slate-700 bg-white"
          />
        </div>
      )}

      {/* 3. Image Rendering (Full natural display) */}
      {isImage && (
        <div className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center">
          <img
            src={content}
            alt={title}
            className="max-w-full h-auto rounded-xl shadow-2xl border border-slate-800 block"
          />
        </div>
      )}

      {/* 4. Text/Generic Document Rendering */}
      {!isHtml && !isPdf && !isImage && content && (
        <div className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <pre className="text-slate-200 font-mono text-sm whitespace-pre-wrap leading-relaxed overflow-x-auto">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
};
