$csv = Get-Content 'C:\Users\gerbsonlima\Downloads\quiz_3000_perguntas.csv'
$seen = @{}
$questions = @()

foreach ($line in $csv) {
  if ($line.StartsWith('Pergunta') -or [string]::IsNullOrWhiteSpace($line)) { continue }
  
  $parts = $line -split ','
  if ($parts.Count -lt 6) { continue }
  
  $q = $parts[0].Trim()
  if ($seen.ContainsKey($q)) { continue }
  
  $seen[$q] = $true
  $questions += @{
    text = $q
    options = @{
      A = $parts[1].Trim()
      B = $parts[2].Trim()
      C = $parts[3].Trim()
      D = $parts[4].Trim()
    }
    correct = $parts[5].Trim()
  }
}

Write-Host "Total de perguntas únicas: $($questions.Count)"
$json = ConvertTo-Json $questions -Depth 10
Set-Content -Path 'c:\Users\gerbsonlima\Music\coro-quixad\public\quiz-data.json' -Value $json
Write-Host 'Salvo em public/quiz-data.json'
