/**
 * CostManager.js
 * Handles bike maintenance costs and chart rendering.
 */
const CostManager = {
    chart: null,

    /**
     * Render the costs chart.
     * @param {HTMLElement} canvas 
     * @param {Array} bikes 
     */
    renderChart(canvas, bikes) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        const data = new Array(12).fill(0);

        bikes.forEach(bike => {
            if (bike.costs) {
                bike.costs.forEach(c => {
                    if (c.year === new Date().getFullYear()) {
                        data[c.month] += parseFloat(c.amount) || 0;
                    }
                });
            }
        });

        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [{
                    label: 'Spese Mensili (€)',
                    data: data,
                    backgroundColor: 'rgba(255, 59, 48, 0.5)',
                    borderColor: '#ff3b30',
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#333' } },
                    x: { grid: { display: false } }
                }
            }
        });
    },

    /**
     * Render the list of costs.
     * @param {HTMLElement} container 
     * @param {Array} bikes 
     * @param {Function} onDelete - Callback(bike, costIndex)
     */
    renderList(container, bikes, onDelete) {
        if (!container) return 0;
        container.innerHTML = '';
        let total = 0;

        bikes.forEach(bike => {
            if (bike.costs) {
                bike.costs.forEach((c, index) => {
                    const amount = parseFloat(c.amount) || 0;
                    total += amount;

                    const div = document.createElement('div');
                    div.className = 'cost-item';
                    div.style.cssText = 'background:#222; padding:12px; border-radius:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border:1px solid #333;';
                    div.innerHTML = `
                        <div style="flex-grow:1; min-width:0; margin-right:12px;">
                            <div style="font-weight:bold; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.desc}</div>
                            <div style="font-size:11px; opacity:0.6;">${bike.model} \u2022 ${c.month + 1}/${c.year}</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
                            <div style="font-weight:bold; color:var(--primary); white-space:nowrap;">\u20ac ${amount.toFixed(2)}</div>
                            <button class="btn-delete-cost btn btn-text" style="color:#ff3b30; width:40px; height:40px; padding:0;">
                                <i data-lucide="trash-2" style="width:18px; pointer-events:none;"></i>
                            </button>
                        </div>
                    `;

                    div.querySelector('.btn-delete-cost').onclick = (e) => {
                        e.stopPropagation();
                        if (onDelete) onDelete(bike, index);
                    };

                    container.appendChild(div);
                });
            }
        });

        return total;
    }
};

export default CostManager;
