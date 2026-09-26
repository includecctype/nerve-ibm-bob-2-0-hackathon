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
