"""Build lazy Unicode subsets of the OFL Source Han Serif CN variable font.
Usage: python scripts/subset_research_font.py SOURCE.woff2
Requires fonttools[woff] and brotli. Original available from Adobe's release branch.
"""
from pathlib import Path
import sys,re
from fontTools.ttLib import TTFont
from fontTools import subset
source=Path(sys.argv[1]);root=Path(__file__).resolve().parent.parent
font=TTFont(source);cmap=font.getBestCmap();available={cp for cp in cmap if cp>=0x2e80}
common=set()
for lead in range(0xb0,0xd8):
 for tail in range(0xa1,0xff):
  try:common.add(ord(bytes([lead,tail]).decode('gb2312')))
  except (UnicodeError,TypeError):pass
for folder in ['js/v2','js/v3','editor-src']:
 for p in (root/folder).glob('*.js'):common.update(map(ord,p.read_text(encoding='utf-8')))
for p in root.glob('*.html'):common.update(map(ord,p.read_text(encoding='utf-8')))
common&=available
remaining=available-common
parts=[('common',common)]
for base in sorted({cp//4096*4096 for cp in remaining}):parts.append((f'{base:x}',{cp for cp in remaining if base<=cp<base+4096}))
def ranges(cps):
 nums=sorted(cps);result=[];start=prev=nums[0]
 for n in nums[1:]:
  if n==prev+1:prev=n;continue
  result.append(f'U+{start:X}'+(f'-{prev:X}' if prev!=start else ''));start=prev=n
 result.append(f'U+{start:X}'+(f'-{prev:X}' if prev!=start else ''))
 return ','.join(result)
css=['/* Source Han Serif CN VF, Adobe, SIL OFL 1.1. Local Unicode subsets; Latin uses Arial. */']
for name,cps in parts:
 if not cps:continue
 f=TTFont(source);opt=subset.Options();opt.flavor='woff2';opt.recalc_bounds=False;opt.recalc_timestamp=False
 sub=subset.Subsetter(options=opt);sub.populate(unicodes=cps);sub.subset(f)
 path=root/'css/fonts'/f'source-han-serif-{name}.woff2';f.save(path)
 css.append('@font-face{font-family:"Source Han Serif SC";font-style:normal;font-weight:250 900;font-display:swap;src:url("fonts/'+path.name+'") format("woff2");unicode-range:'+ranges(cps)+'}')
 print(name,len(cps),path.stat().st_size,flush=True)
(root/'css/research-fonts.css').write_text('\n'.join(css)+'\n',encoding='utf-8')
print('Complete: all',len(available),'CJK codepoints preserved.',flush=True)
