$ids = Get-ChildItem -Path public/images/gym-equipment -Filter *.jpg | ForEach-Object { $_.BaseName.Split('_')[0] } | Sort-Object -Unique
$map = @{}
foreach ($id in $ids) {
    $files = Get-ChildItem -Path public/images/gym-equipment -Filter ("{0}_*" -f $id + "*.jpg") | Sort-Object {
        [int]($_.BaseName -split 'vista-')[1].Replace('.jpg','')
    }
    $first = $files[0]
    $desc = ($first.BaseName -split '_')[1]
    $name = ($desc -replace '-', ' ') 
    $words = $name.ToLower().Split(' ')
    for ($i=0;$i -lt $words.Count;$i++) {
        $words[$i] = [CultureInfo]::CurrentCulture.TextInfo.ToTitleCase($words[$i])
    }
    $name = $words -join ' '
    $views = @()
    foreach ($f in $files) {
        $viewStr = ($f.BaseName -split 'vista-')[1].Replace('.jpg','')
        $views += [int]$viewStr
    }
    $views = $views | Sort-Object
    $map[$id] = @{ name = $name; desc = $desc; views = $views }
}
# Output TS
Write-Output "// Generated from equipment images"
Write-Output "interface EquipmentView {"
Write-Output "    id: number;"
Write-Output "    src: string;"
Write-Output "}"
Write-Output ""
Write-Output "interface EquipmentData {"
Write-Output "    id: string;"
Write-Output "    name: string;"
Write-Output "    views: EquipmentView[];"
Write-Output "}"
Write-Output ""
Write-Output "export const equipmentMap: Record<string, EquipmentData> = {"
foreach ($id in $map.Keys | Sort-Object) {
    $data = $map[$id]
    Write-Output "    `"$id`": {"
    Write-Output "        id: `"$id`","
    Write-Output "        name: `"$($data.name)`","
    Write-Output "        views: ["
    foreach ($v in $data.views) {
        $src = "public/images/gym-equipment/$($id)_$($data.desc)_vista-{0:D2}.jpg" -f $v
        Write-Output "            { id: $v, src: `"$src`" },"
    }
    Write-Output "        ]"
    Write-Output "    },"
}
Write-Output "};"
Write-Output ""
Write-Output "export function getEquipmentViews(id: string): EquipmentData | undefined {"
Write-Output "    return equipmentMap[id];"
Write-Output "}"