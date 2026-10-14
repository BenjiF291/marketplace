Add-Type -AssemblyName System.Drawing
$names=@('Fighter_seb.png','Genious_ben.png','Genious_boris.png','Genious_seb.png','Gold_lotte.png')
$sheet=New-Object Drawing.Bitmap 1100,390
$g=[Drawing.Graphics]::FromImage($sheet); $g.Clear([Drawing.Color]::FromArgb(230,199,137))
$font=New-Object Drawing.Font 'Arial',10
for($i=0;$i -lt $names.Count;$i++){
 $name=$names[$i];$src=New-Object Drawing.Bitmap (Join-Path $PWD ('public/images/'+$name))
 $svg=[xml][IO.File]::ReadAllText((Join-Path $PWD ('public/assets/card-masks/'+$name+'.svg')))
 $path=New-Object Drawing.Drawing2D.GraphicsPath
 foreach($contour in $svg.svg.path.d.Split('Z')){ $matches=[regex]::Matches($contour,'[ML](\d+) (\d+)');if($matches.Count -lt 3){continue};$points=[Drawing.PointF[]]@($matches|ForEach-Object{New-Object Drawing.PointF ([float]$_.Groups[1].Value),([float]$_.Groups[2].Value)});$path.AddPolygon($points) }
 $cut=New-Object Drawing.Bitmap $src.Width,$src.Height
 $cg=[Drawing.Graphics]::FromImage($cut);$cg.SetClip($path);$cg.DrawImage($src,(New-Object Drawing.Rectangle 0,0,$src.Width,$src.Height),0,0,$src.Width,$src.Height,[Drawing.GraphicsUnit]::Pixel);$cg.Dispose()
 $g.DrawString($name,$font,[Drawing.Brushes]::Black,($i*220+8),10)
 $scale=[Math]::Min(195/$src.Width,330/$src.Height)
 $g.DrawImage($cut,([float]($i*220+12)),[float]40,([float]($src.Width*$scale)),([float]($src.Height*$scale)))
 $cut.Dispose();$src.Dispose();$path.Dispose()
}
$g.Dispose();$font.Dispose();$sheet.Save((Join-Path $PWD 'output/card-edge-check.png'));$sheet.Dispose()
