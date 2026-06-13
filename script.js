// =========================
// WHITE SAFFRON INVENTORY - COMPLETE SYSTEM
// =========================

let products = [];
let stockData = {};
let historyData = [];
let currentPage = 1;
let itemsPerPage = 8;
let selectedProductId = null;

// Category Detection Database
const categoryKeywords = {
    "Disposables": ["takeaway cup", "coffee cup", "paper cup", "plastic cup", "disposable", "straw", "lid", "cutlery", "fork", "spoon", "napkin", "food container", "takeout"],
    "Vegetables": ["onion", "tomato", "potato", "carrot", "cucumber", "cabbage", "lettuce", "broccoli", "cauliflower", "spinach", "garlic", "ginger", "chili", "pepper", "eggplant", "crumpy"],
    "Fruits": ["apple", "banana", "orange", "grape", "mango", "strawberry", "watermelon", "pineapple", "peach", "cherry", "kiwi", "lemon", "lime", "pear", "avocado"],
    "Spices": ["saffron", "turmeric", "cumin", "coriander", "cardamom", "cinnamon", "clove", "nutmeg", "pepper", "paprika"],
    "Dairy": ["milk", "cheese", "butter", "yogurt", "cream", "paneer", "curd", "ghee"],
    "Beverages": ["tea", "coffee", "juice", "soda", "water", "energy drink"],
    "Canned Goods": ["baked beans", "canned beans", "canned corn", "canned tuna", "canned soup"],
    "Electronics": ["mouse", "keyboard", "monitor", "cable", "webcam", "speaker", "headphone", "laptop", "phone", "charger"]
};

function detectCategory(productName) {
    if (!productName) return "";
    const lowerName = productName.toLowerCase().trim();
    for (let [category, keywords] of Object.entries(categoryKeywords)) {
        for (let keyword of keywords) {
            if (lowerName.includes(keyword)) return category;
        }
    }
    return "";
}

function suggestUnit(productName, category) {
    const name = productName?.toLowerCase() || "";
    if (category === "Disposables") return "pcs";
    if (category === "Vegetables" || category === "Fruits") return "kg";
    if (category === "Spices") return "gram";
    if (category === "Beverages") return "L";
    if (category === "Canned Goods") return "can";
    return "pcs";
}

function generateSKU(category, productName, existingSKUs) {
    let categoryCode = category ? category.substring(0, 3).toUpperCase() : "PRD";
    if (categoryCode === "DIS") categoryCode = "DSP";
    let nameCode = productName ? productName.substring(0, 2).toUpperCase() : "XX";
    const prefix = `${categoryCode}-${nameCode}`;
    const existingNumbers = existingSKUs.filter(s => s.startsWith(prefix)).map(s => {
        const match = s.match(/\d+$/);
        return match ? parseInt(match[0]) : 0;
    });
    let nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
}

// Default Products
const defaultProducts = [
    { id: 1, sku: "ELE-MO-001", name: "Wireless Mouse", category: "Electronics", unit: "pcs", rate: 25.00, minStock: 10 },
    { id: 2, sku: "VEG-ON-001", name: "Onion", category: "Vegetables", unit: "kg", rate: 0.80, minStock: 50, stock: 100 },
    { id: 3, sku: "VEG-TO-001", name: "Tomato", category: "Vegetables", unit: "kg", rate: 0.60, minStock: 40 },
    { id: 4, sku: "FRU-AP-001", name: "Apple", category: "Fruits", unit: "kg", rate: 3.00, minStock: 30 },
    { id: 5, sku: "DSP-TC-001", name: "Takeaway Cup", category: "Disposables", unit: "pcs", rate: 0.15, minStock: 500 },
    { id: 6, sku: "CAN-BB-001", name: "Baked Beans", category: "Canned Goods", unit: "can", rate: 2.50, minStock: 20 }
];

function loadData() {
    const storedProducts = localStorage.getItem("ws_products");
    if (storedProducts) products = JSON.parse(storedProducts);
    else products = [...defaultProducts];
    
    const storedStock = localStorage.getItem("ws_stock");
    if (storedStock) stockData = JSON.parse(storedStock);
    else {
        stockData = {};
        products.forEach(p => {
            let initialStock = p.stock || Math.floor(Math.random() * 45) + 8;
            stockData[p.sku] = { qty: initialStock, minStock: p.minStock, updated: new Date().toLocaleString() };
        });
    }
    
    const storedHistory = localStorage.getItem("ws_history");
    if (storedHistory) historyData = JSON.parse(storedHistory);
    else historyData = [];
    
    if (historyData.length === 0) {
        products.forEach(p => {
            historyData.unshift({ id: Date.now(), date: new Date().toLocaleString(), sku: p.sku, productName: p.name, type: "INIT", quantity: stockData[p.sku]?.qty || 0, previousStock: 0, newStock: stockData[p.sku]?.qty || 0, userNote: "Initial stock" });
        });
    }
    
    saveAll();
    renderAll();
}

function saveAll() {
    localStorage.setItem("ws_products", JSON.stringify(products));
    localStorage.setItem("ws_stock", JSON.stringify(stockData));
    localStorage.setItem("ws_history", JSON.stringify(historyData));
    document.getElementById("lastUpdated").innerText = `Last Updated: ${new Date().toLocaleString()}`;
}

function addHistory(sku, pName, type, qty, prev, newStock, note) {
    historyData.unshift({ id: Date.now(), date: new Date().toLocaleString(), sku, productName: pName, type, quantity: qty, previousStock: prev, newStock: newStock, userNote: note });
    if (historyData.length > 500) historyData.pop();
    saveAll();
}

function renderAll() {
    renderProductTable();
    updateDashboard();
    populateDropdowns();
    renderHistory();
}

function renderProductTable() {
    const search = document.getElementById("searchInput").value.toLowerCase();
    let filtered = products.filter(p => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search) || (p.category || "").toLowerCase().includes(search));
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const tbody = document.getElementById("productTable");
    tbody.innerHTML = "";
    
    paginated.forEach(p => {
        const stock = stockData[p.sku]?.qty || 0;
        const min = stockData[p.sku]?.minStock || p.minStock;
        let statusClass = "status-ok", statusText = "OK";
        if (stock <= 0) { statusClass = "status-out"; statusText = "OUT"; }
        else if (stock <= min) { statusClass = "status-low"; statusText = "LOW"; }
        const isSelected = selectedProductId === p.id;
        
        tbody.innerHTML += `<tr class="${isSelected ? 'selected-row' : ''}" onclick="selectProduct(${p.id})">
            <td>${p.id}</td><td><strong>${escapeHtml(p.name)}</strong></td><td><code>${escapeHtml(p.sku)}</code></td>
            <td><span style="background:#f1f5f9; padding:4px 8px; border-radius:6px;">${escapeHtml(p.category || '-')}</span></td>
            <td><span class="${statusClass}">${stock} ${statusText}</span></td>
            <td>$${p.rate.toFixed(2)}</td><td>${escapeHtml(p.unit || 'pcs')}</td><td>${min}</td>
            <td>$${(stock * p.rate).toFixed(2)}</td><td>${stockData[p.sku]?.updated || '-'}</td>
            <td><button class="edit-btn" onclick="event.stopPropagation(); editProductById(${p.id})"><i class="fa fa-pen"></i> Edit</button>
            <button class="delete-btn" onclick="event.stopPropagation(); deleteProductById(${p.id})"><i class="fa fa-trash"></i> Del</button></td>
        </tr>`;
    });
    
    document.getElementById("pagination").innerHTML = `
        <button ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(-1)">‹ Prev</button>
        <span>Page ${currentPage} of ${totalPages || 1}</span>
        <button ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} onclick="changePage(1)">Next ›</button>
    `;
}

function selectProduct(id) { selectedProductId = id; renderProductTable(); showToast(`Selected: ${products.find(p => p.id === id)?.name}`, false); }
function changePage(delta) { const newPage = currentPage + delta; if (newPage >= 1 && newPage <= Math.ceil(products.length / itemsPerPage)) { currentPage = newPage; renderProductTable(); } }

function updateDashboard() {
    let totalStock = 0, lowCount = 0, totalValue = 0, lowNames = [];
    products.forEach(p => {
        let q = stockData[p.sku]?.qty || 0;
        totalStock += q;
        totalValue += q * p.rate;
        if (q <= (stockData[p.sku]?.minStock || p.minStock)) { lowCount++; lowNames.push(p.name); }
    });
    document.getElementById("totalProducts").innerText = products.length;
    document.getElementById("totalStock").innerText = totalStock;
    document.getElementById("lowStock").innerText = lowCount;
    document.getElementById("inventoryValue").innerText = "$" + totalValue.toFixed(2);
    const warnBox = document.getElementById("lowStockWarning");
    warnBox.innerHTML = lowCount ? `⚠️ Low stock: ${lowNames.slice(0, 5).join(", ")}` : "✅ All stock levels are healthy";
}

function populateDropdowns() {
    ["stockInProduct", "stockOutProduct", "adjustProduct"].forEach(id => {
        let sel = document.getElementById(id);
        if (sel) {
            sel.innerHTML = products.map(p => `<option value="${escapeHtml(p.sku)}">${escapeHtml(p.name)} (${p.sku}) - Stock: ${stockData[p.sku]?.qty || 0} ${p.unit || ''}</option>`).join("");
            if (id === "adjustProduct") {
                sel.addEventListener("change", updateAdjustmentPreview);
            }
        }
    });
    const today = new Date().toISOString().split('T')[0];
    ["stockInDate", "stockOutDate", "adjustDate"].forEach(id => { let el = document.getElementById(id); if (el && !el.value) el.value = today; });
}

function updateAdjustmentPreview() {
    const sku = document.getElementById("adjustProduct").value;
    const newQty = document.getElementById("adjustQty").value;
    if (sku && stockData[sku]) {
        const currentStock = stockData[sku].qty;
        const newStock = parseInt(newQty);
        if (!isNaN(newStock)) {
            const diff = newStock - currentStock;
            const previewDiv = document.getElementById("adjustPreview");
            const previewSpan = document.getElementById("adjustChangePreview");
            if (diff !== 0) {
                previewDiv.style.display = "block";
                const diffText = diff > 0 ? `+${diff}` : `${diff}`;
                const color = diff > 0 ? "#16a34a" : "#dc2626";
                previewSpan.innerHTML = `${diffText} ${stockData[sku].unit || 'units'} (${currentStock} → ${newStock})`;
                previewSpan.style.color = color;
            } else {
                previewDiv.style.display = "none";
            }
        }
    }
}

function renderHistory() {
    let tbody = document.getElementById("historyTable");
    tbody.innerHTML = "";
    historyData.slice(0, 150).forEach(h => {
        tbody.innerHTML += `<tr>
            <td>${h.date}</td>
            <td><strong>${escapeHtml(h.productName)}</strong></td>
            <td>${escapeHtml(h.sku)}</td>
            <td>${h.type}</td>
            <td>${h.quantity}${h.type === "ADJUST" ? '' : ''}</td>
            <td>${h.previousStock}</td>
            <td>${h.newStock}</td>
            <td>${escapeHtml(h.userNote || '-')}</td>
        </tr>`;
    });
}

function editProductById(id) {
    const p = products.find(p => p.id === id);
    if (p) {
        document.getElementById("modalTitle").innerText = "Edit Product";
        document.getElementById("editProductId").value = p.id;
        document.getElementById("productSKU").value = p.sku;
        document.getElementById("productName").value = p.name;
        document.getElementById("productCategory").value = p.category || "";
        document.getElementById("unit").value = p.unit || "pcs";
        document.getElementById("rate").value = p.rate;
        document.getElementById("modalMinStock").value = p.minStock;
        document.getElementById("modalStock").value = stockData[p.sku]?.qty || 0;
        
        document.getElementById("autoSkuPreview").style.display = "none";
        document.getElementById("skuContainer").style.display = "block";
        document.getElementById("categoryHint").innerHTML = "";
        document.getElementById("productModal").style.display = "flex";
        selectedProductId = id;
    }
}

function deleteProductById(id) {
    if (confirm("Delete this product?")) {
        const p = products.find(p => p.id === id);
        if (p) {
            delete stockData[p.sku];
            products = products.filter(p => p.id !== id);
            addHistory(p.sku, p.name, "DELETE", 0, 0, 0, "Product deleted");
            saveAll();
            renderAll();
            showToast(`Deleted ${p.name}`, false);
            if (selectedProductId === id) selectedProductId = null;
        }
    }
}

function updateAutoCategory() {
    const productName = document.getElementById("productName").value;
    const categoryField = document.getElementById("productCategory");
    const categoryHint = document.getElementById("categoryHint");
    const unitSelect = document.getElementById("unit");
    const editId = document.getElementById("editProductId").value;
    
    if (!editId && productName && productName.length > 2) {
        const detectedCategory = detectCategory(productName);
        if (detectedCategory) {
            categoryHint.innerHTML = `<i class="fa-solid fa-magic"></i> Detected: ${detectedCategory}`;
            if (!categoryField.value) {
                categoryField.value = detectedCategory;
                categoryField.style.background = "#f0fdf4";
                setTimeout(() => { categoryField.style.background = ""; }, 500);
                const suggestedUnit = suggestUnit(productName, detectedCategory);
                if (suggestedUnit && unitSelect.querySelector(`option[value="${suggestedUnit}"]`)) {
                    unitSelect.value = suggestedUnit;
                }
            }
        } else {
            categoryHint.innerHTML = `<i class="fa-solid fa-question-circle"></i> Click "Auto Detect"`;
        }
    }
}

function manualDetectCategory() {
    const productName = document.getElementById("productName").value;
    if (!productName) { showToast("Enter product name first", true); return; }
    const detectedCategory = detectCategory(productName);
    if (detectedCategory) {
        document.getElementById("productCategory").value = detectedCategory;
        showToast(`Category set to: ${detectedCategory}`, false);
        const suggestedUnit = suggestUnit(productName, detectedCategory);
        if (suggestedUnit) {
            const unitSelect = document.getElementById("unit");
            if (unitSelect.querySelector(`option[value="${suggestedUnit}"]`)) unitSelect.value = suggestedUnit;
        }
    } else {
        showToast("Could not detect category. Please select manually.", true);
    }
}

function updateAutoSKUPreview() {
    const category = document.getElementById("productCategory").value;
    const name = document.getElementById("productName").value;
    const editId = document.getElementById("editProductId").value;
    if (!editId && category && name) {
        const newSKU = generateSKU(category, name, products.map(p => p.sku));
        document.getElementById("previewSku").innerText = newSKU;
        document.getElementById("autoSkuPreview").style.display = "block";
        document.getElementById("skuContainer").style.display = "none";
    } else if (!editId && (!category || !name)) {
        document.getElementById("autoSkuPreview").style.display = "block";
        document.getElementById("skuContainer").style.display = "none";
        document.getElementById("previewSku").innerText = "Enter category and name";
    }
}

function saveProductFromModal() {
    let id = document.getElementById("editProductId").value;
    let sku = document.getElementById("productSKU").value.trim();
    let name = document.getElementById("productName").value.trim();
    let category = document.getElementById("productCategory").value.trim();
    let unit = document.getElementById("unit").value;
    let rate = parseFloat(document.getElementById("rate").value);
    let minStock = parseInt(document.getElementById("modalMinStock").value);
    let initStock = parseInt(document.getElementById("modalStock").value);
    
    if (!name || isNaN(rate)) { showToast("Name and Rate required", true); return; }
    if (!category && name && !id) category = detectCategory(name) || "General";
    
    if (id) {
        let index = products.findIndex(p => p.id == id);
        if (index !== -1) {
            let oldSku = products[index].sku;
            if (!sku) { showToast("SKU required", true); return; }
            if (oldSku !== sku && products.some(p => p.sku === sku && p.id != id)) { showToast("SKU exists!", true); return; }
            products[index] = { ...products[index], sku, name, category: category || "General", unit, rate, minStock };
            if (oldSku !== sku) { stockData[sku] = stockData[oldSku]; delete stockData[oldSku]; }
            if (stockData[sku]) stockData[sku].minStock = minStock;
            addHistory(sku, name, "EDIT", 0, 0, stockData[sku]?.qty || 0, "Product edited");
            showToast("Product updated");
        }
    } else {
        if (!category) category = "General";
        sku = generateSKU(category, name, products.map(p => p.sku));
        if (!sku) { showToast("Could not generate SKU", true); return; }
        if (products.some(p => p.sku === sku)) { showToast("SKU conflict!", true); return; }
        let newId = Date.now();
        products.push({ id: newId, sku, name, category, unit, rate, minStock });
        if (!stockData[sku]) stockData[sku] = { qty: initStock, minStock, updated: new Date().toLocaleString() };
        addHistory(sku, name, "ADD", initStock, 0, initStock, "New product");
        showToast(`Added "${name}" with SKU: ${sku}`);
    }
    saveAll();
    renderAll();
    closeModal();
}

function performStockMove(type) {
    let sku = "", qty = 0, note = "", dateField = "";
    if (type === "IN") { sku = document.getElementById("stockInProduct").value; qty = parseInt(document.getElementById("stockInQty").value); note = document.getElementById("stockInNote").value; dateField = document.getElementById("stockInDate").value; }
    else if (type === "OUT") { sku = document.getElementById("stockOutProduct").value; qty = parseInt(document.getElementById("stockOutQty").value); note = document.getElementById("stockOutNote").value; dateField = document.getElementById("stockOutDate").value; }
    else { sku = document.getElementById("adjustProduct").value; qty = parseInt(document.getElementById("adjustQty").value); note = document.getElementById("adjustReason").value; dateField = document.getElementById("adjustDate").value; }
    
    let product = products.find(p => p.sku === sku);
    if (!product) { showToast("Product error", true); return; }
    if (!stockData[sku]) stockData[sku] = { qty: 0, minStock: product.minStock };
    let oldQty = stockData[sku].qty;
    
    if (type === "IN") {
        if (isNaN(qty) || qty <= 0) { showToast("Valid quantity required", true); return; }
        stockData[sku].qty += qty;
        addHistory(sku, product.name, "IN", qty, oldQty, stockData[sku].qty, `${note} | ${dateField}`);
        showToast(`+${qty} ${product.unit} of ${product.name}`);
        document.getElementById("stockInQty").value = "";
    } else if (type === "OUT") {
        if (isNaN(qty) || qty <= 0 || qty > oldQty) { showToast(`Insufficient stock! Only ${oldQty} available`, true); return; }
        stockData[sku].qty -= qty;
        addHistory(sku, product.name, "OUT", qty, oldQty, stockData[sku].qty, `${note} | ${dateField}`);
        showToast(`-${qty} ${product.unit} of ${product.name}`);
        document.getElementById("stockOutQty").value = "";
    } else if (type === "ADJUST") {
        if (isNaN(qty) || qty < 0) { showToast("Valid new quantity required", true); return; }
        const diff = qty - oldQty;
        stockData[sku].qty = qty;
        addHistory(sku, product.name, "ADJUST", Math.abs(diff), oldQty, qty, `${note} | ${dateField} | Change: ${diff > 0 ? '+' : ''}${diff}`);
        showToast(`Adjusted ${product.name} from ${oldQty} to ${qty} ${product.unit}`);
        document.getElementById("adjustQty").value = "";
        document.getElementById("adjustReason").value = "";
        document.getElementById("adjustPreview").style.display = "none";
    }
    stockData[sku].updated = new Date().toLocaleString();
    stockData[sku].unit = product.unit;
    saveAll();
    renderAll();
}

function exportCSV() {
    let headers = ["SKU", "Name", "Category", "Unit", "Rate", "Stock", "MinStock", "Value"];
    let rows = products.map(p => [p.sku, p.name, p.category || "", p.unit, p.rate, stockData[p.sku]?.qty || 0, p.minStock, ((stockData[p.sku]?.qty || 0) * p.rate).toFixed(2)]);
    let csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    let blob = new Blob([csv], { type: "text/csv" });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast("Exported CSV");
}

function importCSV(file) {
    let reader = new FileReader();
    reader.onload = e => {
        let rows = e.target.result.split("\n").slice(1);
        let imported = 0;
        rows.forEach(row => {
            let cols = row.split(",").map(c => c.replace(/^"|"$/g, '').trim());
            if (cols.length >= 5 && cols[1]) {
                let sku = cols[0], name = cols[1], cat = cols[2] || detectCategory(name), rate = parseFloat(cols[4]);
                if (sku && name && !isNaN(rate) && !products.find(p => p.sku === sku)) {
                    products.push({ id: Date.now() + Math.random(), sku, name, category: cat || "General", unit: cols[3] || "pcs", rate, minStock: 10 });
                    if (!stockData[sku]) stockData[sku] = { qty: 0, minStock: 10, updated: new Date().toLocaleString() };
                    imported++;
                }
            }
        });
        if (imported) { saveAll(); renderAll(); showToast(`Imported ${imported} products`); }
        else showToast("No valid products found", true);
    };
    reader.readAsText(file);
}

function downloadSampleCSV() {
    let sample = [["SKU", "Name", "Category", "Unit", "Rate"], ["VEG-CR-001", "Crumpy", "Vegetables", "kg", 0.00]];
    let csv = sample.map(r => r.join(",")).join("\n");
    let blob = new Blob([csv], { type: "text/csv" });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sample_template.csv";
    a.click();
}

function closeModal() {
    document.getElementById("productModal").style.display = "none";
    document.getElementById("autoSkuPreview").style.display = "block";
    document.getElementById("skuContainer").style.display = "none";
    document.getElementById("editProductId").value = "";
    document.getElementById("productSKU").value = "";
    document.getElementById("productName").value = "";
    document.getElementById("productCategory").value = "";
    document.getElementById("unit").value = "pcs";
    document.getElementById("rate").value = "";
    document.getElementById("modalMinStock").value = "10";
    document.getElementById("modalStock").value = "0";
    document.getElementById("previewSku").innerText = "Enter category and name";
    document.getElementById("categoryHint").innerHTML = "";
}

function showToast(msg, isErr = false) { 
    let t = document.getElementById("toast"); 
    t.innerText = msg; 
    t.style.background = isErr ? "#dc2626" : "#16a34a"; 
    t.classList.add("show"); 
    setTimeout(() => t.classList.remove("show"), 3000); 
}

function escapeHtml(s) { 
    if (!s) return ''; 
    return String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); 
}

function showSection(sectionId) { 
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active-section")); 
    document.getElementById(sectionId).classList.add("active-section"); 
    document.querySelectorAll(".menu li").forEach(li => li.classList.remove("active")); 
    let active = Array.from(document.querySelectorAll(".menu li")).find(li => li.getAttribute("data-section") === sectionId); 
    if (active) active.classList.add("active"); 
    if (sectionId === "products") { currentPage = 1; renderProductTable(); } 
    if (sectionId === "history") renderHistory(); 
}

// Event Listeners
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("productName").addEventListener("input", function() { updateAutoCategory(); updateAutoSKUPreview(); });
    document.getElementById("productCategory").addEventListener("input", updateAutoSKUPreview);
    document.getElementById("detectCategoryBtn").onclick = manualDetectCategory;
    document.getElementById("adjustQty").addEventListener("input", updateAdjustmentPreview);
    
    document.getElementById("openAddModalBtn").onclick = () => {
        document.getElementById("editProductId").value = "";
        document.getElementById("productSKU").value = "";
        document.getElementById("productName").value = "";
        document.getElementById("productCategory").value = "";
        document.getElementById("unit").value = "pcs";
        document.getElementById("rate").value = "";
        document.getElementById("modalMinStock").value = "10";
        document.getElementById("modalStock").value = "0";
        document.getElementById("modalTitle").innerText = "Add Product";
        document.getElementById("autoSkuPreview").style.display = "block";
        document.getElementById("skuContainer").style.display = "none";
        document.getElementById("previewSku").innerText = "Enter category and name";
        document.getElementById("categoryHint").innerHTML = "";
        document.getElementById("productModal").style.display = "flex";
    };
    
    document.getElementById("globalEditBtn").onclick = () => { if (selectedProductId) editProductById(selectedProductId); else showToast("Select a product first", true); };
    document.getElementById("globalDeleteBtn").onclick = () => { if (selectedProductId) deleteProductById(selectedProductId); else showToast("Select a product first", true); };
    document.getElementById("saveProductBtn").onclick = saveProductFromModal;
    document.getElementById("modalCloseBtn").onclick = closeModal;
    document.getElementById("stockInExecute").onclick = () => performStockMove("IN");
    document.getElementById("stockOutExecute").onclick = () => performStockMove("OUT");
    document.getElementById("adjustExecute").onclick = () => performStockMove("ADJUST");
    document.getElementById("exportCsvMainBtn").onclick = exportCSV;
    document.getElementById("exportCsvAction").onclick = exportCSV;
    document.getElementById("importCsvAction").onclick = () => { let f = document.getElementById("csvFileInput").files[0]; if (f) importCSV(f); else showToast("Select CSV file", true); };
    document.getElementById("sampleCsvAction").onclick = downloadSampleCSV;
    document.getElementById("importTriggerBtn").onclick = () => document.getElementById("csvFileInput").click();
    document.getElementById("navStockInBtn").onclick = () => showSection("stockin");
    document.getElementById("navStockOutBtn").onclick = () => showSection("stockout");
    document.getElementById("navAdjustBtn").onclick = () => showSection("adjustment");
    document.querySelectorAll(".menu li").forEach(li => li.onclick = () => { let sec = li.getAttribute("data-section"); if (sec) showSection(sec); });
    document.getElementById("searchInput").addEventListener("input", () => { currentPage = 1; renderProductTable(); });
    window.onclick = function(e) { if (e.target === document.getElementById("productModal")) closeModal(); };
    setInterval(() => { document.getElementById("currentDate").innerHTML = new Date().toLocaleDateString() + " | " + new Date().toLocaleTimeString(); }, 1000);
    loadData();
});