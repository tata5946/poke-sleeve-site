param(
  [int]$Port = 8123,
  [string]$Root = "."
)

$ErrorActionPreference = "Stop"

$rootPath = (Resolve-Path -LiteralPath $Root).Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

$mimeMap = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".gif"  = "image/gif"
  ".ico"  = "image/x-icon"
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    try {
      $rawPath = [Uri]::UnescapeDataString($request.Url.AbsolutePath.TrimStart("/"))
      if ([string]::IsNullOrWhiteSpace($rawPath)) { $rawPath = "index.html" }
      $candidate = Join-Path $rootPath $rawPath
      $fullPath = [System.IO.Path]::GetFullPath($candidate)

      if (-not $fullPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        $response.StatusCode = 403
        $response.Close()
        continue
      }

      if ((Test-Path -LiteralPath $fullPath -PathType Container)) {
        $fullPath = Join-Path $fullPath "index.html"
      }

      if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        $response.StatusCode = 404
        $response.Close()
        continue
      }

      $ext = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
      $contentType = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($fullPath)
      $response.ContentType = $contentType
      $response.ContentLength64 = $bytes.LongLength
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
      $response.OutputStream.Close()
    } catch {
      $response.StatusCode = 500
      $response.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
