# Generate vector display masks; the original PNG files are only read.
param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class CardMaskGenerator {
 public static bool Generate(string source, string destination) {
  using (var input = new Bitmap(source))
  using (var bitmap = input.Clone(new Rectangle(0,0,input.Width,input.Height), PixelFormat.Format32bppArgb)) {
   int w=bitmap.Width,h=bitmap.Height,count=w*h;
   var locked=bitmap.LockBits(new Rectangle(0,0,w,h),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
   var pixels=new byte[locked.Stride*h];
   Marshal.Copy(locked.Scan0,pixels,0,pixels.Length);int stride=locked.Stride;bitmap.UnlockBits(locked);
   var outside=new bool[count];var queue=new int[count];int head=0,tail=0,white=0;
   Action<int> visit=index=>{
    if(outside[index])return;int at=(index/w)*stride+(index%w)*4;
    bool transparent=pixels[at+3]==0;
    // Include neutral off-white matte pixels at the outside, but keep colored edges.
    int low=Math.Min(pixels[at],Math.Min(pixels[at+1],pixels[at+2])),high=Math.Max(pixels[at],Math.Max(pixels[at+1],pixels[at+2]));
    bool background=low>=242&&high-low<=10;
    if(!transparent&&!background)return;
    if(background&&!transparent)white++;
    outside[index]=true;queue[tail++]=index;
   };
   for(int x=0;x<w;x++){visit(x);visit((h-1)*w+x);}
   for(int y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}
   while(head<tail){int at=queue[head++],x=at%w,y=at/w;if(x>0)visit(at-1);if(x+1<w)visit(at+1);if(y>0)visit(at-w);if(y+1<h)visit(at+w);}
   // Do not mask blank/mostly-white images or images with no white surround.
   if(white<10||tail>count*.7)return false;
   // Remove isolated matte speckles and one-pixel connections to border debris.
   // Opening only affects the silhouette; the source RGB and all interior artwork stay intact.
   var core=new bool[count];for(int y=1;y<h-1;y++)for(int x=1;x<w-1;x++){
    int at=y*w+x;bool keep=true;for(int dy=-1;dy<=1&&keep;dy++)for(int dx=-1;dx<=1;dx++)if(outside[at+dy*w+dx]){keep=false;break;}core[at]=keep;
   }
   var visited=new bool[count];var largest=new List<int>();
   for(int i=0;i<count;i++){if(!core[i]||visited[i])continue;head=0;tail=0;queue[tail++]=i;visited[i]=true;var component=new List<int>();
    while(head<tail){int at=queue[head++];component.Add(at);int x=at%w,y=at/w;for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){int nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;int next=ny*w+nx;if(core[next]&&!visited[next]){visited[next]=true;queue[tail++]=next;}}}
    if(component.Count>largest.Count)largest=component;
   }
   if(largest.Count<count*.2)return false;
   var clean=new bool[count];foreach(int at in largest){int x=at%w,y=at/w;for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){int nx=x+dx,ny=y+dy;if(nx>=0&&nx<w&&ny>=0&&ny<h&&!outside[ny*w+nx])clean[ny*w+nx]=true;}}
   // Deliberately crop into the card itself, including its outer printed frame.
   // Color-based fringe removal left pale lines behind. A uniform inset removes
   // those lines even when the matte is tinted or blended with the original border.
   int inset=Math.Max(3,(int)Math.Ceiling(Math.Min(w,h)*.018));
   var trimmed=new bool[count];
   for(int y=inset;y<h-inset;y++)for(int x=inset;x<w-inset;x++){
    int at=y*w+x;if(!clean[at])continue;bool keep=true;
    for(int dy=-inset;dy<=inset&&keep;dy++)for(int dx=-inset;dx<=inset;dx++){
     if(dx*dx+dy*dy>inset*inset)continue;
     if(!clean[at+dy*w+dx]){keep=false;break;}
    }
    trimmed[at]=keep;
   }
   for(int i=0;i<count;i++)outside[i]=!trimmed[i];
   // Trace continuous boundaries instead of hundreds of one-pixel rectangles.
   // A single outline scales smoothly and does not introduce scanline seams.
   int pitch=w+1;var edges=new Dictionary<int,List<int>>();
   Action<int,int> edge=(from,to)=>{List<int> list;if(!edges.TryGetValue(from,out list)){list=new List<int>();edges[from]=list;}list.Add(to);};
   for(int y=0;y<h;y++)for(int x=0;x<w;x++){
    int at=y*w+x;if(outside[at])continue;int top=y*pitch+x;
    if(y==0||outside[at-w])edge(top,top+1);
    if(x==w-1||outside[at+1])edge(top+1,top+1+pitch);
    if(y==h-1||outside[at+w])edge(top+1+pitch,top+pitch);
    if(x==0||outside[at-1])edge(top+pitch,top);
   }
   Func<int,int,int> direction=(from,to)=>to==from+1?0:to==from+pitch?1:to==from-1?2:3;
   var path=new StringBuilder();
   while(edges.Count>0){int start=0;foreach(int key in edges.Keys){start=key;break;}int current=start,previousDirection=-1;var points=new List<int>();
    do{points.Add(current);var choices=edges[current];int chosen=0,best=10;
     for(int i=0;i<choices.Count;i++){int turn=previousDirection<0?0:(direction(current,choices[i])-previousDirection+4)%4;int score=turn==1?0:turn==0?1:turn==3?2:3;if(score<best){best=score;chosen=i;}}
     int next=choices[chosen];choices.RemoveAt(chosen);if(choices.Count==0)edges.Remove(current);previousDirection=direction(current,next);current=next;
    }while(current!=start);
    var corners=new List<int>();for(int i=0;i<points.Count;i++){int before=points[(i+points.Count-1)%points.Count],now=points[i],after=points[(i+1)%points.Count];if(direction(before,now)!=direction(now,after))corners.Add(now);}
    for(int i=0;i<corners.Count;i++)path.Append(i==0?"M":"L").Append(corners[i]%pitch).Append(' ').Append(corners[i]/pitch);path.Append('Z');
   }
   File.WriteAllText(destination,"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\""+w+"\" height=\""+h+"\" viewBox=\"0 0 "+w+" "+h+"\"><path fill=\"white\" d=\""+path+"\"/></svg>",new UTF8Encoding(false));
   return true;
  }
 }
}
'@
$imageDirectory = Join-Path $ProjectRoot 'public/images'
$maskDirectory = Join-Path $ProjectRoot 'public/assets/card-masks'
[void](New-Item -ItemType Directory -Force -Path $maskDirectory)
$manifest = [ordered]@{}
foreach ($file in (Get-ChildItem -LiteralPath $imageDirectory -Filter '*.png' | Sort-Object Name)) {
  if ([CardMaskGenerator]::Generate($file.FullName, (Join-Path $maskDirectory ($file.Name + '.svg')))) {
    $maskPath = Join-Path $maskDirectory ($file.Name + '.svg')
    $manifest[$file.Name] = [ordered]@{sourceHash=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant();maskHash=(Get-FileHash -LiteralPath $maskPath -Algorithm SHA256).Hash.ToLowerInvariant();maskData='data:image/svg+xml;base64,'+[Convert]::ToBase64String([IO.File]::ReadAllBytes($maskPath))}
  }
}
$javascript = '/* Generated by scripts/generate-card-masks.ps1; original images remain unchanged. */' + "`nwindow.CardMaskFiles=" + (ConvertTo-Json -InputObject $manifest -Compress) + ';' + "`n"
[IO.File]::WriteAllText((Join-Path $ProjectRoot 'public/card-mask-files.js'), $javascript, (New-Object Text.UTF8Encoding($false)))
Write-Output ("Generated display masks for {0} cards." -f $manifest.Count)
