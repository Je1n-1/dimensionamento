/* Dados do projeto e migração de backups; sem fórmulas de dimensionamento. */
(function (root) {
  "use strict";
  const id = () => crypto.randomUUID();
  const supplyDefaults = () => ({
    phases: "tri",
    network: "127/220",
    phaseVoltage: 127,
    lineVoltage: 220,
  });
  const newLoad = () => ({
    id: id(),
    description: "Equipamento",
    quantity: 1,
    power: 100,
    unit: "W",
    powerFactor: 1,
    efficiency: 0.9,
    distance: 10,
  });
  const newCircuit = () => ({
    id: id(),
    number: "",
    source: null,
    planningOrigin: null,
    description: "",
    type: "lighting",
    connection: "fn",
    phaseSet: "A",
    voltageMode: "auto",
    voltage: 127,
    legacyLoaded: null,
    loads: [newLoad()],
    routeMode: "linear",
    installation: "embedded",
    wall: "masonry",
    cableForm: "single",
    conduitType: "PVC",
    methodOverride: "",
    insulation: "PVC",
    metal: "Cu",
    groupCount: 1,
    groupLayout: "bundle",
    temperature: 30,
    maxDrop: 4,
    breakerMode: "auto",
    breakerCurrent: 10,
    breakerCurve: "C",
    i2Factor: 1.45,
    breakingCapacityType: "Icn",
    breakerIcu: "",
    shortIk: "",
    soilResistance: "",
    soilDepth: "",
    unknownInstallation: false,
  });
  function cleanLoad(data) {
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw Error("Equipamento inválido no arquivo.");
    const result = newLoad();
    for (const key of Object.keys(result))
      if (Object.hasOwn(data, key)) result[key] = data[key];
    result.id =
      typeof result.id === "string" && result.id.length < 80 ? result.id : id();
    result.description = String(result.description ?? "").slice(0, 100);
    return result;
  }
  function cleanCircuit(data) {
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw Error("Circuito inválido no arquivo.");
    const result = newCircuit();
    for (const key of Object.keys(result))
      if (Object.hasOwn(data, key)) result[key] = data[key];
    result.id =
      typeof result.id === "string" && result.id.length < 80 ? result.id : id();
    result.description = String(result.description ?? "").slice(0, 70);
    result.number = String(result.number ?? "").slice(0, 30);
    result.source =
      result.source && typeof result.source === "object"
        ? JSON.parse(JSON.stringify(result.source))
        : null;
    if (!Object.hasOwn(data, "loads")) {
      result.loads = [
        cleanLoad({
          description: data.description || "Carga original",
          quantity: data.quantity ?? 1,
          power: data.power ?? 100,
          unit: data.unit || "W",
          powerFactor: data.powerFactor ?? 1,
          efficiency: data.efficiency ?? 0.9,
          distance: data.length ?? 0,
        }),
      ];
      result.connection = data.phase === "tri" ? "tri" : "legacy";
      result.phaseSet = data.phase === "tri" ? "ABC" : "A";
      result.voltageMode = "manual";
      result.legacyLoaded = data.loaded ?? (data.phase === "tri" ? 3 : 2);
      result.breakingCapacityType = "Icu";
    }
    if (
      !Array.isArray(result.loads) ||
      !result.loads.length ||
      result.loads.length > 100
    )
      throw Error("Use de 1 a 100 grupos por circuito.");
    result.loads = result.loads.map(cleanLoad);
    const seen = new Set();
    for (const load of result.loads) {
      if (seen.has(load.id)) load.id = id();
      seen.add(load.id);
    }
    return result;
  }
  function cleanSupply(data) {
    const result = { ...supplyDefaults(), ...(data || {}) };
    if (
      !["mono", "bi", "tri"].includes(result.phases) ||
      !["127/220", "220/380", "custom"].includes(result.network)
    )
      throw Error("Alimentação da instalação inválida.");
    if (
      result.network === "custom" &&
      (!(+result.phaseVoltage > 0) ||
        !(+result.lineVoltage > 0) ||
        !Number.isFinite(+result.phaseVoltage) ||
        !Number.isFinite(+result.lineVoltage))
    )
      throw Error("Tensões da rede inválidas.");
    return {
      phases: result.phases,
      network: result.network,
      phaseVoltage: result.phaseVoltage,
      lineVoltage: result.lineVoltage,
    };
  }
  const contextDefaults = () => ({
    propertyType: "house",
    rooms: [],
    equipment: [],
    distribute: true,
    conditions: { temperature: 30, groupCount: 1 },
  });
  function cleanContext(data) {
    const result = contextDefaults();
    if (data == null) return result;
    if (typeof data !== "object" || Array.isArray(data))
      throw Error("Contexto do projeto inválido.");
    result.propertyType = [
      "house",
      "apartment",
      "commercial",
      "other",
    ].includes(data.propertyType)
      ? data.propertyType
      : "other";
    if (
      !Array.isArray(data.rooms) ||
      data.rooms.length > 100 ||
      !Array.isArray(data.equipment) ||
      data.equipment.length > 100
    )
      throw Error("Use até 100 ambientes e 100 grupos de equipamentos.");
    result.rooms = data.rooms.map((room) => String(room).slice(0, 60));
    const keys = [
      "id",
      "kind",
      "name",
      "room",
      "quantity",
      "power",
      "powerFactor",
      "distance",
      "connection",
    ];
    result.equipment = data.equipment.map((item) => {
      if (!item || typeof item !== "object")
        throw Error("Equipamento do projeto inválido.");
      return Object.fromEntries(
        keys.map((key) => [
          key,
          String(item[key] ?? "").slice(0, key === "name" ? 70 : 80),
        ]),
      );
    });
    result.distribute = data.distribute !== false;
    result.conditions = {
      temperature: data.conditions?.temperature ?? 30,
      groupCount: data.conditions?.groupCount ?? 1,
    };
    return result;
  }
  function readProject(data, requireFormat = false) {
    if (!data || !Array.isArray(data.circuits) || data.circuits.length > 300)
      throw Error("Projeto inválido ou acima de 300 circuitos.");
    if (
      requireFormat &&
      !["VoltCalcGuiado-v2", "VoltCalcGuiado-v3"].includes(data.format)
    )
      throw Error("Formato de backup não reconhecido.");
    const reactance =
      data.reactance === undefined ? 0.08 : Number(data.reactance);
    if (
      data.reactance === null ||
      data.reactance === "" ||
      !Number.isFinite(reactance) ||
      reactance < 0 ||
      reactance > 2
    )
      throw Error("Reatância inválida.");
    const circuits = data.circuits.map(cleanCircuit),
      seen = new Set();
    for (const c of circuits) {
      if (seen.has(c.id))
        throw Error("IDs de circuitos duplicados no arquivo.");
      seen.add(c.id);
    }
    return {
      projectName: String(data.projectName || "Meu projeto").slice(0, 60),
      context: cleanContext(data.context),
      circuits,
      draft: data.draft
        ? cleanCircuit(data.draft)
        : cleanCircuit(circuits[0] || newCircuit()),
      editingId: circuits.some((c) => c.id === data.editingId)
        ? data.editingId
        : null,
      selected: data.selected || null,
      supply: cleanSupply(data.supply),
      reactance,
      importInfo: data.importInfo
        ? JSON.parse(JSON.stringify(data.importInfo))
        : null,
    };
  }
  function projectData(state) {
    return {
      format: "VoltCalcGuiado-v3",
      schemaVersion: 3,
      reference: "NBR5410:1997",
      projectName: state.projectName,
      context: state.context || contextDefaults(),
      circuits: state.circuits,
      draft: state.draft,
      editingId: state.editingId,
      selected: state.selected,
      supply: state.supply,
      reactance: state.reactance,
      importInfo: state.importInfo || null,
    };
  }
  root.VoltModel = {
    id,
    newLoad,
    newCircuit,
    supplyDefaults,
    cleanCircuit,
    readProject,
    projectData,
    contextDefaults,
    cleanContext,
  };
})(typeof window === "undefined" ? globalThis : window);
