#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env.local"
TARGET_KEYS=(
  AWS_REGION
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AMAZON_POLLY_DEFAULT_VOICE_PROFILE
  AMAZON_POLLY_OUTPUT_FORMAT
  AMAZON_POLLY_SAMPLE_RATE
  LISTENING_EXERCISE_PROVIDER
  AI_PLANNING_PROVIDER
  DEEPSEEK_API_KEY
)

for KEY in "${TARGET_KEYS[@]}"; do
  if grep -q "^${KEY}=" "$ENV_FILE"; then
    VALUE=$(grep "^${KEY}=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    if [ -n "$VALUE" ]; then
      echo "$VALUE" | npx vercel env add "$KEY" production preview --yes > /dev/null 2>&1
    fi
  fi
done

# Self-destruct
rm -- "$0"
