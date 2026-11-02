// GitHub presents some commit messages without their raw terminal LF.
// This rule applies only after the exact content-addressed SHA is matched.
// Whitespace inside the message, CR, extra LFs and operation trailer all matter.
export function commitIdentity(expected,observed) {
 const b=expected.body,message=typeof observed?.message==='string'?observed.message:null;
 const actor=(a,e)=>a?.name===e.name&&a?.email===e.email&&Number.isFinite(Date.parse(a?.date))&&Date.parse(a.date)===Date.parse(e.date);
 const fields={expectedSha:expected.sha,observedSha:observed?.sha,expectedTree:b.tree,observedTree:observed?.tree?.sha,
  treeMatches:observed?.tree?.sha===b.tree,parentsMatch:JSON.stringify(observed?.parents?.map(p=>p.sha))===JSON.stringify(b.parents),
  messageMatches:message===b.message||b.message.endsWith('\n')&&message===b.message.slice(0,-1),
  authorMatches:actor(observed?.author,b.author),committerMatches:actor(observed?.committer,b.committer),
  expectedLength:b.message.length,observedLength:message?.length??0,expectedTerminalLf:b.message.endsWith('\n'),observedTerminalLf:message?.endsWith('\n')??false,failedCheck:'COMMIT_IDENTITY'};
 return {matched:observed?.sha===expected.sha&&fields.treeMatches&&fields.parentsMatch&&fields.messageMatches&&fields.authorMatches&&fields.committerMatches,diagnostics:fields};
}
