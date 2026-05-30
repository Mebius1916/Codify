export const PREVIEW_SHELL_STYLE = `    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: rgb(12, 14, 23) !important;
      }
      #preview-container {
        position: relative;
        overflow: hidden;
        width: 100%;
        height: 100%;
        background-color: #0c0e17 !important;
        background-image:
          linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px),
          linear-gradient(rgba(148, 163, 184, 0.09) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, 0.09) 1px, transparent 1px),
          radial-gradient(circle at 50% 12%, rgba(56, 189, 248, 0.09), rgba(12, 14, 23, 0) 55%);
        background-size: 16px 16px, 16px 16px, 96px 96px, 96px 96px, 100% 100%;
        background-position: 0 0, 0 0, 0 0, 0 0;
      }
      #preview-scale-root {
        width: var(--preview-width, 0px);
        height: var(--preview-height, 0px);
        position: absolute;
        left: 0;
        top: 0;
        opacity: var(--preview-ready-opacity, 0);
        transition: opacity 120ms ease;
        background-color: #ffffff;
        box-shadow: 0 22px 48px rgba(0, 0, 0, 0.5), 0 3px 10px rgba(0, 0, 0, 0.35);
        outline: 1px solid rgba(148, 163, 184, 0.2);
        transform: translate(var(--preview-offset-x, 0px), var(--preview-offset-y, 0px)) scale(var(--preview-scale, 1));
        transform-origin: top left;
        will-change: transform;
      }
    </style>
`
