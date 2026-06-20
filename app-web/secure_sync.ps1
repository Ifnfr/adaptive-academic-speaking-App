$envFile = ".env.local"
$keys = @(
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AMAZON_POLLY_DEFAULT_VOICE_PROFILE",
  "AMAZON_POLLY_OUTPUT_FORMAT",
  "AMAZON_POLLY_SAMPLE_RATE",
  "LISTENING_EXERCISE_PROVIDER",
  "AI_PLANNING_PROVIDER",
  "DEEPSEEK_API_KEY"
)
foreach ($key in $keys) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^$key=" }
  if ($line) {
    $value = $line -replace "^$key=", "" -replace "\"", "" -replace "'", ""
    if ($value) {
      $value | npx vercel env add $key production preview --yes > $null 2>&1
    }
  }
}
# Self‑delete the script
Remove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force
