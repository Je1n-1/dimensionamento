/** Read-only index of declared links. Electrical validation stays in Python. */
export function consumerWorkflow(project, consumer) {
  const ownPanel = project.panels.find(p => p.consumerId === consumer.id);
  const circuits = project.circuits.filter(c => consumer.type === 'panel'
    ? ownPanel && ((c.destinationPanelIds || []).includes(ownPanel.id) || c.originPanelId === ownPanel.id)
    : c.consumerIds.includes(consumer.id));
  const segmentIds = [...new Set(circuits.flatMap(c => (c.segmentIds || [])))];
  const segments = project.segments.filter(s => segmentIds.includes(s.id));
  const cables = (project.cables || []).filter(f => circuits.some(c => c.id === f.circuitId));
  const panels = project.panels.filter(p => circuits.some(c => c.originPanelId === p.id));
  const issues = [];
  const add = (message, collection, id) => issues.push({message, collection, id});
  if (!circuits.length) add(consumer.type === 'panel'
    ? 'Quadro cadastrado; vincule as saídas e, quando houver, o circuito alimentador.'
    : 'Falta vincular a um circuito. Uma referência de trecho no planejamento não cria o percurso.', null, null);
  for (const c of circuits) {
    if (!c.originNodeId) add(`${c.tag}: falta definir o ponto de origem.`, 'circuits', c.id);
    if (!c.segmentIds.length) add(`${c.tag}: falta selecionar os trechos percorridos.`, 'circuits', c.id);
    if (c.segmentIds.some(id => !project.segments.some(s => s.id === id))) add(`${c.tag}: existe referência a trecho ausente.`, 'circuits', c.id);
    if (!cables.some(f => f.circuitId === c.id)) add(`${c.tag}: falta cadastrar a formação de cabos.`, 'circuits', c.id);
    if (consumer.type !== 'panel' && consumer.panelId && consumer.panelId !== c.originPanelId)
      add(`${c.tag}: o quadro do planejamento diverge da origem do circuito. Revise os dois cadastros; nada foi substituído.`, 'circuits', c.id);
  }
  for (const s of segments) {
    const missing = [['length','comprimento físico'],['installationMethod','método'],['temperature','temperatura']]
      .filter(([k]) => s[k] == null || s[k] === '').map(([,label]) => label);
    if (missing.length) add(`${s.tag}: informe ${missing.join(', ')} no trecho.`, 'segments', s.id);
  }
  for (const f of cables) {
    const cores = project.conductors.filter(c => c.cableId === f.id);
    if (!cores.length) add(`${f.tag}: faltam as funções dos condutores.`, 'cables', f.id);
    else if (cores.some(c => !c.material || !c.insulation)) add(`${f.tag}: informe material e isolação nos condutores.`, 'cables', f.id);
  }
  return {circuits, segments, cables, panels, ownPanel, issues, linked: circuits.length > 0};
}

export function consumerSegmentOptions(project, consumer) {
  const actual = consumerWorkflow(project, consumer).segments.map(s => [s.id, s.tag]);
  const planned = consumer.plannedSegmentId || consumer.plannedSegmentTag;
  if (planned) actual.push([planned, project.segments.find(s => s.id === planned)?.tag || consumer.plannedSegmentTag || planned]);
  return actual;
}
