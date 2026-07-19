const API_URL = 'https://finanzas.juangranados.org';
let todosLosGastos = [];
let todosLosIngresos = [];
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
        // Pedimos ingresos y gastos al mismo tiempo
        const [resGastos, resIngresos] = await Promise.all([
            fetch(`${API_URL}/api/gastos/usuario/${usuario.id}`, { cache: 'no-store' }),
            fetch(`${API_URL}/api/finanzas/ingresos/usuario/${usuario.id}`, { cache: 'no-store' })
        ]);
        
        todosLosGastos = await resGastos.json();
        todosLosIngresos = await resIngresos.json();

        // Extraer los años únicos donde haya ingresos o gastos
        const aniosDisponibles = new Set();
        todosLosGastos.forEach(g => aniosDisponibles.add(g.fechaCompra.split('-')[0]));
        todosLosIngresos.forEach(i => aniosDisponibles.add(i.fechaDeposito.split('-')[0]));

        // Llenar el selector de años
        const selectAnio = document.getElementById('filtro-anio');
        selectAnio.innerHTML = ''; 
        
        const aniosOrdenados = Array.from(aniosDisponibles).sort((a, b) => b - a);
        
        if (aniosOrdenados.length === 0) {
            selectAnio.innerHTML = '<option value="">No hay registros</option>';
            document.getElementById('historial-completo-body').innerHTML = '<tr><td colspan="4" style="text-align: center;">Sin datos.</td></tr>';
            return;
        }

        aniosOrdenados.forEach(anio => {
            selectAnio.innerHTML += `<option value="${anio}">${anio}</option>`;
        });

        // Procesar automáticamente el año más reciente al cargar la página
        procesarDatosPorAnio(aniosOrdenados[0]);

    } catch (error) {
        console.error("Error al cargar el historial:", error);
        document.getElementById('historial-completo-body').innerHTML = '<tr><td colspan="4" style="text-align: center;">Error al cargar datos.</td></tr>';
    }
}

function procesarDatosPorAnio(anioSeleccionado) {
    // 1. Filtrar los datos del año seleccionado
    const gastosDelAnio = todosLosGastos.filter(g => g.fechaCompra.startsWith(anioSeleccionado));
    const ingresosDelAnio = todosLosIngresos.filter(i => i.fechaDeposito.startsWith(anioSeleccionado));

    // 2. Variables para los totales y los 12 meses
    let totalGastosAnual = 0;
    let totalIngresosAnual = 0;
    
    // Arrays de 12 posiciones (Enero a Diciembre) inicializados en 0
    let gastosPorMes = new Array(12).fill(0);
    let ingresosPorMes = new Array(12).fill(0); 

    // 3. Sumar Gastos
    gastosDelAnio.forEach(gasto => {
        totalGastosAnual += gasto.montoTotal;
        const mesIndex = parseInt(gasto.fechaCompra.split('-')[1]) - 1;
        gastosPorMes[mesIndex] += gasto.montoTotal;
    });

    // 4. Sumar Ingresos
    ingresosDelAnio.forEach(ingreso => {
        totalIngresosAnual += ingreso.salarioQuincenal;
        const mesIndex = parseInt(ingreso.fechaDeposito.split('-')[1]) - 1;
        ingresosPorMes[mesIndex] += ingreso.salarioQuincenal;
    });

    // 5. Actualizar los Widgets superiores
    document.getElementById('total-anio-gastos').textContent = formatearMoneda(totalGastosAnual);
    document.getElementById('total-anio-ingresos').textContent = formatearMoneda(totalIngresosAnual);

    // 6. Llenar la Tabla Resumen
    const tbody = document.getElementById('historial-completo-body');
    tbody.innerHTML = '';
    
    const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    let hayDatos = false;

    // Recorremos los 12 meses para pintar las filas
    for (let i = 0; i < 12; i++) {
        // Solo mostramos los meses que tuvieron algún movimiento de entrada o salida
        if (ingresosPorMes[i] > 0 || gastosPorMes[i] > 0) {
            hayDatos = true;
            
            // Calculamos el Balance del mes
            const balance = ingresosPorMes[i] - gastosPorMes[i];
            const colorBalance = balance >= 0 ? 'var(--success-color)' : 'var(--error-color)';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600;">${nombresMeses[i]}</td>
                <td style="color: var(--success-color); font-weight: bold;">${formatearMoneda(ingresosPorMes[i])}</td>
                <td style="color: var(--error-color); font-weight: bold;">${formatearMoneda(gastosPorMes[i])}</td>
                <td style="color: ${colorBalance}; font-weight: bold;">${formatearMoneda(balance)}</td>
            `;
            tbody.appendChild(tr);
        }
    }

    if (!hayDatos) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No hay movimientos en este año.</td></tr>';
    }

    // 7. Dibujar la gráfica comparativa doble
    dibujarGraficaMensual(ingresosPorMes, gastosPorMes, anioSeleccionado);
}

function dibujarGraficaMensual(datosIngresos, datosGastos, anio) {
    const ctx = document.getElementById('graficaAnual').getContext('2d');
    
    if (graficaMensual) {
        graficaMensual.destroy();
    }
    
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    graficaMensual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: nombresMeses,
            datasets: [
                {
                    label: `Ingresos ${anio}`,
                    data: datosIngresos,
                    backgroundColor: '#10b981', // Verde
                    borderRadius: 4,
                    maxBarThickness: 25
                },
                {
                    label: `Gastos ${anio}`,
                    data: datosGastos,
                    backgroundColor: '#ef4444', // Rojo
                    borderRadius: 4,
                    maxBarThickness: 25
                }
            ]
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
                            return context.dataset.label + ': ' + formatearMoneda(context.raw);
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