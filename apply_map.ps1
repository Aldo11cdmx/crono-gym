$mappings = @(
  @{eq='CG-EQP-0014';name='Máquina Crunch Abdominal';ids=@('1452','3760','0600');base='/images/gym-equipment/CG-EQP-0014_maquina-crunch-abdominal_vista-';max=3},
  @{eq='CG-EQP-0020';name='Silla Romana';ids=@('2963','1761','0709','0472');base='/images/gym-equipment/CG-EQP-0020_maquina-fondos-y-abdominales-silla-romana_vista-';max=3},
  @{eq='CG-EQP-0028';name='Banco Declinado Abdominales';ids=@('0277','0282','0491','0495');base='/images/gym-equipment/CG-EQP-0028_banco-declinado-abdominales_vista-';max=4},
  @{eq='CG-EQP-0022';name='Torre de Poleas';ids=@('0175','0874','0222','0243','0174','0212','0873');base='/images/gym-equipment/CG-EQP-0022_torre-de-poleas-estacion_vista-';max=1},
  @{eq='CG-EQP-0062';name='Banco Multiposición';ids=@('0570','0620','0689');base='/images/gym-equipment/CG-EQP-0062_banco-multiposicion_vista-';max=1},
  @{eq='CG-EQP-0064';name='Pelota de Pilates';ids=@('0271','0272','1707','0650');base='/images/gym-equipment/CG-EQP-0064_pelota-pilates_vista-';max=1}
)
$json = Get-Content -Raw -Encoding UTF8 'src/data/exercisesCatalog.json'
$data = $json | ConvertFrom-Json
$updated = 0
foreach($m in $mappings){
  $urls = @()
  for($i=1; $i -le $m.max; $i++){
    $urls += ($m.base + $i.ToString('00') + '.jpg')
  }
  foreach($ex in $data){
    if($m.ids -contains $ex.id){
      $ex | Add-Member -NotePropertyName equipment_id -NotePropertyValue $m.eq -Force
      $ex | Add-Member -NotePropertyName equipment_name -NotePropertyValue $m.name -Force
      $ex | Add-Member -NotePropertyName image_urls -NotePropertyValue $urls -Force
      $updated++
    }
  }
}
$data | ConvertTo-Json -Depth 10 -Compress:$false | Set-Content -Path 'src/data/exercisesCatalog.json' -Encoding UTF8
Write-Output "updated:$updated"
