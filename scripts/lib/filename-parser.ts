import path from 'node:path';
const acronyms=new Map([['api','API'],['sql','SQL'],['dfs','DFS'],['bfs','BFS'],['url','URL'],['html','HTML']]);
export function deriveTitle(file:string,problemId:number):string{let base=path.basename(file);base=base.replace(/\.[^.]+$/,'').replace(/\.solution$/i,'').replace(new RegExp(`^${problemId}(?:[._ -]+|$)`),'').replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();if(!base||/^problem$/i.test(base))return`Problem ${problemId}`;return base.split(' ').map((w,i)=>acronyms.get(w.toLowerCase())??(i>0&&['in','of','to','and','or','the'].includes(w.toLowerCase())?w.toLowerCase():w.charAt(0).toUpperCase()+w.slice(1).toLowerCase())).join(' ')}
export function problemIdFromFilename(file:string):number|null{const m=/^(\d+)(?:[._ -]|$)/.exec(path.basename(file));return m?Number(m[1]):null}
export function slugify(title:string){return title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
