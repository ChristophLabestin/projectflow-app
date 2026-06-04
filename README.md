# ProjectFlow

ProjectFlow is a multi-tenant project management app for execution, structured ideation, collaboration, and AI-assisted project work.

## Project Brain

The durable repository knowledge base lives in [brain/README.md](./brain/README.md). Start there for product context, architecture, commands, validation rules, handoffs, and migrated documentation.

## Run Locally

Prerequisites: Node.js.

1. Install dependencies: `cd web && npm install`
2. Set `GEMINI_API_KEY` in `web/.env.local`
3. Start the dev server: `cd web && npm run dev`

## Common Commands

- Web build: `cd web && npm run build`
- Web tests: `cd web && npm run test:run`
- Theme lint: `cd web && npm run lint:theme`
- Functions build: `cd functions && npm run build`
- Swift simulator build: `xcodebuild -project swift/projectflow.xcodeproj -scheme projectflow -sdk iphonesimulator -derivedDataPath .xcodebuild build`

See [brain/commands-and-environment.md](./brain/commands-and-environment.md) for the full command and environment list.
