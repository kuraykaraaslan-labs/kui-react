# OrgChart

- **id:** `org-chart`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/OrgChart.tsx`
- **status:** stable
- **since:** 2026-10

A top-down tree of the host's own cards joined by connector lines: nested or flat data (buildOrgTree), collapsible subtrees, highlight that opens the path to every match (search), zoom, and a keyboard tree (Up parent, Down first child, Left/Right siblings, Enter clicks, * opens all children).

## Variants

### With search

```tsx
<OrgChart roots={roots} getId={…} getChildren={…} highlight={match} renderNode={(n) => <EmployeeCard … />} />
```

## Full source

```tsx
const roots = buildOrgTree(employees, (e) => e.id, (e) => e.managerId);

<OrgChart
  roots={roots}
  getId={(n) => n.node.id}
  getChildren={(n) => n.children}
  defaultExpandedDepth={2}
  highlight={query ? (n) => n.node.name.toLowerCase().includes(query) : undefined}
  onNodeClick={(n) => router.push(`/employees/${n.node.id}`)}
  renderNode={(n) => <EmployeeCard employee={n.node} />}
/>
```
