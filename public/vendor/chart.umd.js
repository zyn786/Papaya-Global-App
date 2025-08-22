new Chart(ctx, {
  type:'line',
  data:{ /* … */ },
  options:{
    responsive:true,
    maintainAspectRatio:false,   // ← honors the .chart-fixed height
    plugins:{ legend:{ position:'top' } },
    scales:{ y:{ ticks:{ callback:v=>fmt.format(v) } } }
  }
});