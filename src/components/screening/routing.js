const normalize = title => title.trim().toLowerCase().replace(/\s+/g, " ");

export function isSplitPosting(title) {
  return normalize(title).replaceAll(" ", "") === "warehousepicker/packer";
}

export function isWarehouseSplitPair(first, second) {
  return [normalize(first), normalize(second)].sort().join("|") === "warehouse packer|warehouse picker";
}
