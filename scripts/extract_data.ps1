[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$sourcePath = 'F:\옮겨 갈 자료\대입관련\2022~2021 수시 정시 입결(대입정보포털 어디가 공개자료)_대교협 대입상담센터.xlsb'
$outputPath = Join-Path $PSScriptRoot '..\public\data\raw_admission_2022.json'

Write-Host "Opening Excel file: $sourcePath"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.AskToUpdateLinks = $false
$excel.AutomationSecurity = 3

try {
    $wb = $excel.Workbooks.Open($sourcePath, 0, $true, 5, '', '', $true)
    $sheet = $wb.Sheets.Item('수시')
    $totalRows = $sheet.UsedRange.Rows.Count
    $totalCols = 31

    Write-Host "Reading UsedRange: rows 6 to $totalRows, cols 1 to $totalCols..."
    $range = $sheet.Range($sheet.Cells.Item(6, 1), $sheet.Cells.Item($totalRows, $totalCols))
    $arr = $range.Value2

    $wb.Close($false)
    Write-Host "Excel data loaded into memory in $($sw.ElapsedMilliseconds) ms. Transforming objects..."

    $rowCount = $arr.GetLength(0)
    $list = [System.Collections.Generic.List[object]]::new($rowCount)

    for ($i = 1; $i -le $rowCount; $i++) {
        $univ = [string]$arr[$i, 3]
        $major = [string]$arr[$i, 7]
        if ([string]::IsNullOrWhiteSpace($univ) -or [string]::IsNullOrWhiteSpace($major)) {
            continue
        }

        # 2022 stats
        $c22_70 = [string]$arr[$i, 17]
        $c22_50 = [string]$arr[$i, 16]
        $rate22 = [string]$arr[$i, 10]
        $recruit22 = [string]$arr[$i, 8]
        $apply22 = [string]$arr[$i, 9]
        $fillRate22 = [string]$arr[$i, 12]

        # 2021 stats
        $c21_70 = [string]$arr[$i, 29]
        $c21_50 = [string]$arr[$i, 28]
        $rate21 = [string]$arr[$i, 22]

        # Parse numeric cut70 if valid
        $cut70_num = $null
        $parsed = 0.0
        if ([double]::TryParse($c22_70.Trim(), [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) {
            $cut70_num = [Math]::Round($parsed, 2)
        }

        $cut50_num = $null
        if ([double]::TryParse($c22_50.Trim(), [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) {
            $cut50_num = [Math]::Round($parsed, 2)
        }

        $cut21_70_num = $null
        if ([double]::TryParse($c21_70.Trim(), [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) {
            $cut21_70_num = [Math]::Round($parsed, 2)
        }

        $item = [PSCustomObject]@{
            id = $i
            region = ([string]$arr[$i, 2]).Trim()
            univ = $univ.Trim()
            type = ([string]$arr[$i, 4]).Trim()
            evalType = ([string]$arr[$i, 5]).Trim()
            field = ([string]$arr[$i, 6]).Trim()
            major = $major.Trim()
            recruit = ([string]$recruit22).Trim()
            apply = ([string]$apply22).Trim()
            compRate = ([string]$rate22).Trim()
            fillRate = ([string]$fillRate22).Trim()
            cut50 = $cut50_num
            cut70 = $cut70_num
            cut70_raw = $c22_70.Trim()
            cut50_raw = $c22_50.Trim()
            subject = ([string]$arr[$i, 18]).Trim()
            cut21_70 = $cut21_70_num
            rate21 = ([string]$rate21).Trim()
        }
        $list.Add($item)
    }

    Write-Host "Parsed $($list.Count) valid entries. Serializing to JSON..."
    $json = $list | ConvertTo-Json -Depth 4 -Compress
    [System.IO.File]::WriteAllText($outputPath, $json, [System.Text.Encoding]::UTF8)

    $sw.Stop()
    Write-Host "Success! File saved to $outputPath. Total time: $($sw.ElapsedMilliseconds) ms."
}
finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
