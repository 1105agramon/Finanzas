const API_URL = 'https://finanzas.juangranados.org';
let todosLosGastos = [];
let graficaMensual = null;

// 1. Verificación de Seguridad
const usuarioStorage = localStorage.getItem('usuarioLogueado');
if (!usuarioStorage) {
    window.location.replace('../index.html');
    throw new Error("No hay sesión activa");
}
const usuario = JSON.parse(usuarioStorage);

// 2. Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', cargarTodoElHistorial);

// Evento cuando el usuario cambia el año en el selector
document.getElementById('filtro-anio').addEventListener('change', (e) => {
    procesarDatosPorAnio(e.target.value);
});

async function cargarTodoElHistorial() {
    try {
        const res = await fetch(`${API_URL}/api/gastos/usuario/${usuario.id}`, { cache: 'no-store' });
        todosLosGastos = await res.json();

        // Extraer los años únicos de todos los gastos para llenar el <select>
        const aniosDisponibles = new Set();
        todosLosGastos.forEach(gasto => {
            const anio = gasto.fechaCompra.split('-')[0]; // Extrae el "2026" de "2026-07-14"
            aniosDisponibles.add(anio);
        });

        // Llenar el selector de años
        const selectAnio = document.getElementById('filtro-anio');
        selectAnio.innerHTML = ''; // Limpiar
        
        // Convertir el Set a Array y ordenarlo de mayor a menor (años recientes primero)
        const aniosOrdenados = Array.from(aniosDisponibles).sort((a, b) => b - a);
        
        if (aniosOrdenados.length === 0) {
            selectAnio.innerHTML = '<option value="">No hay gastos registrados</option>';
            return;
        }

        aniosOrdenados.forEach(anio => {
            selectAnio.innerHTML += `<option value="${anio}">${anio}</option>`;
        });

        // Procesar automáticamente el año más reciente al cargar la página
        procesarDatosPorAnio(aniosOrdenados[0]);

    } catch (error) {
        console.error("Error al cargar el historial:", error);
    }
}

function procesarDatosPorAnio(anioSeleccionado) {
    // 1. Filtrar solo los gastos que pertenecen al año seleccionado
    const gastosDelAnio = todosLosGastos.filter(gasto => gasto.fechaCompra.startsWith(anioSeleccionado));

    // 2. Ordenar por fecha de forma descendente (más recientes arriba)
    gastosDelAnio.sort((a, b) => new Date(b.fechaCompra) - new Date(a.fechaCompra));

    // 3. Variables para la gráfica y totales
    let totalAnual = 0;
    // Array de 12 posiciones (Enero a Diciembre) inicializado en 0
    let sumasPorMes = new Array(12).fill(0); 

    const tbody = document.getElementById('historial-completo-body');
    tbody.innerHTML = '';

    // 4. Recorrer los gastos del año para llenar la tabla y sumar por meses
    gastosDelAnio.forEach(gasto => {
        // Sumar al total anual
        totalAnual += gasto.montoTotal;

        // Extraer el mes del gasto (Formato YYYY-MM-DD)
        // Restamos 1 porque los arrays empiezan en 0 (Enero = 0, Febrero = 1...)
        const mesIndex = parseInt(gasto.fechaCompra.split('-')[1]) - 1;
        sumasPorMes[mesIndex] += gasto.montoTotal;

        // Crear fila para la tabla
        const fechaObj = new Date(gasto.fechaCompra + 'T00:00:00');
        const fechaStr = fechaObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600;">${fechaStr}</td>
            <td>${gasto.concepto}</td>
            <td>${gasto.categoria}</td>
            <td style="color: var(--error-color); font-weight: bold;">${formatearMoneda(gasto.montoTotal)}</td>
        `;
        tbody.appendChild(tr);
    });

    if (gastosDelAnio.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No hay gastos en este año.</td></tr>';
    }

    // 5. Actualizar el widget de Total Anual
    document.getElementById('total-anio').textContent = formatearMoneda(totalAnual);

    // 6. Dibujar la gráfica con las sumas de cada mes
    dibujarGraficaMensual(sumasPorMes, anioSeleccionado);
}

function dibujarGraficaMensual(datosMeses, anio) {
    const ctx = document.getElementById('graficaAnual').getContext('2d');
    
    if (graficaMensual) {
        graficaMensual.destroy();
    }
    
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    graficaMensual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: nombresMeses,
            datasets: [{
                label: `Gastos Totales ${anio}`,
                data: datosMeses,
                backgroundColor: '#ef4444', // Rojo para gastos
                borderRadius: 4,
                maxBarThickness: 35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Total: ' + formatearMoneda(context.raw);
                        }
                    }
                }
            }
        }
    });
}

function formatearMoneda(cantidad) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(cantidad);
}