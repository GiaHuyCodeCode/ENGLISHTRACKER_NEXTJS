const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/page.tsx');
let content = fs.readFileSync(file, 'utf8');

// Inject console.log into the filter function
const target = `const filteredMgmtAssignments = allAssignments.filter(a => {`;
const replacement = `const filteredMgmtAssignments = allAssignments.filter(a => {
              // DEBUG
              if (window.DEBUG_FILTER) {
                console.log('DEBUG: filtering assignment', a.id, a.type, a.skill, a.createdAt, 'with skillFilter', mgmtSkillFilter, 'and dateFilter', mgmtDateFilter);
              }
`;
content = content.replace(target, replacement);

fs.writeFileSync(file, content);
