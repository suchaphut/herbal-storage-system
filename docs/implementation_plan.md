# Deployment Implementation Plan

## Goal
Enable deployment of the "Herbal Storage System" to Render.com. The project requires a hybrid environment with both Node.js (for Next.js frontend/backend) and Python (for ML models: Prophet, Isolation Forest). The chosen strategy is **Docker**, which provides the most reliable way to package these mixed dependencies.

## User Review Required
> [!NOTE]
> This plan introduces a `Dockerfile` to the project root. This is the standard way to deploy complex apps to Render.

## Proposed Changes

### Next.js Configuration
#### [MODIFY] [next.config.mjs](file:///c:/Users/perap/Documents/GitHub/v0-io-t-herbal-storage-system/next.config.mjs)
- Add `output: "standalone"` to the configuration. This tells Next.js to create a focused build folder that includes only necessary production dependencies, perfect for Docker.

### Docker Configuration
#### [NEW] [Dockerfile](file:///c:/Users/perap/Documents/GitHub/v0-io-t-herbal-storage-system/Dockerfile)
- **Base Image**: `node:20-slim` (lightweight Node.js).
- **System Dependencies**: Install `python3`, `python3-pip`, `python3-venv`, and `build-essential` (needed for some Python libraries).
- **Build Stage**: 
  - Install npm dependencies.
  - Run `npm run build`.
- **Production Stage**:
  - Copy standalone build artifacts.
  - Create a Python virtual environment (`venv`).
  - Install Python libraries from `scripts/requirements-ml.txt`.
  - Expose port 3000.
  - Start command: `node server.js`.

#### [NEW] [.dockerignore](file:///c:/Users/perap/Documents/GitHub/v0-io-t-herbal-storage-system/.dockerignore)
- Ignore `node_modules`, `.next`, `.git`, `.venv`, and other local artifacts to keep the build context small.

### Render Configuration
#### [NEW] [render.yaml](file:///c:/Users/perap/Documents/GitHub/v0-io-t-herbal-storage-system/render.yaml)
- Define a "Web Service" type.
- Runtime: `docker`.
- Region: `singapore` (closest to user, assuming user is in Thailand based on timezone).
- Environment Variables:
  - `MONGODB_URI`: (User must provide this).
  - `ENABLE_PYTHON_ML`: `true`.

## Verification Plan

### Manual Verification
1.  **Code Review**: Inspect the generated `Dockerfile` to ensure it correctly handles both implementation languages.
2.  **Deployment Test**:
    -   Push changes to GitHub.
    -   Connect valid repo to Render.
    -   Verify that Render detects the `Dockerfile` or `render.yaml`.
    -   Monitor build logs for successful Python dependency installation.
