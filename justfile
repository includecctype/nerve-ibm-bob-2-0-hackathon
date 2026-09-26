doppler_project := "ibm-bob-2-hackathon"
doppler_config  := "dev_personal"

# Launch opencode with secrets injected
opencode:
	doppler run --project {{doppler_project}} --config {{doppler_config}} -- opencode

# Resume the last opencode session
opencode-continue:
	doppler run --project {{doppler_project}} --config {{doppler_config}} -- opencode --continue

# Launch IBM Bob interactive chat with secrets injected
bob:
	doppler run --project {{doppler_project}} --config {{doppler_config}} -- bob chat

# Run a single Bob task headless: just bob-run "your prompt"
bob-run prompt:
	doppler run --project {{doppler_project}} --config {{doppler_config}} -- bob run {{prompt}}

# Open the Bob resume picker, or resume a specific task: just bob-resume <task-id>
bob-resume task_id="":
	doppler run --project {{doppler_project}} --config {{doppler_config}} -- bob -r {{task_id}}

# --- Local development ------------------------------------------------------

# Run the gateway backend locally (uvicorn on :8000)
backend:
	doppler run --project {{doppler_project}} --config {{doppler_config}} -- sh -c "cd backend && uv run uvicorn main:app --host 0.0.0.0 --port 8000"

# Install dependencies and start the terminal client
frontend:
	doppler run --project {{doppler_project}} --config {{doppler_config}} -- sh -c "cd terminal && pnpm install --frozen-lockfile && pnpm dev"

# Start the backend in docker, then the terminal client
run: docker-up
	just frontend

# --- Docker -----------------------------------------------------------------

# Build and start the backend container
docker-up:
	docker compose up -d

# Stop the containers
docker-down:
	docker compose down

# Build the backend image
docker-build:
	docker compose build

# Rebuild the backend image without cached layers
docker-build-no-cache:
	docker compose build --no-cache

# Follow the backend container logs
docker-logs:
	docker compose logs -f backend
