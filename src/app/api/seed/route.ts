import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/shared/lib/supabase/server'

// Catálogo completo de 131 insumos/productos exportado de productos.xlsx
// Ejecutar una sola vez: POST /api/seed?secret=CRON_SECRET
const CATALOG = [
  {"name":"Ganchos en \"S\" para ollas","unit":"Piece","category":"Utensilios","cost_per_unit":219.8869,"codigo":"GNCH22","referencia_interna":"E-1151","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Hoja de 95mm para Máquina Selladora","unit":"Piece","category":"Otros","cost_per_unit":2707.511,"codigo":"1000002240","referencia_interna":"E-1156","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Aro para selladora de PLA","unit":"4pcs/Set","category":"Utensilios","cost_per_unit":2838.05,"codigo":"1000001957","referencia_interna":"E-1165","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Máquina Dispensadora de Jarabe 24 Botones","unit":"Piece","category":"Equipos","cost_per_unit":750,"codigo":"31016205","referencia_interna":"E-1176","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Selladora marca Freser","unit":"Piece","category":"Equipos","cost_per_unit":25569,"codigo":"31063239","referencia_interna":"E-1177","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Aro para Creme Brulee","unit":"Piece","category":"Utensilios","cost_per_unit":231.66,"codigo":"CBRING","referencia_interna":"E-11F3","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Agua Goddess Athena 500 ml","unit":"Paquete 6 (botella 500 ml)","category":"Insumos","cost_per_unit":90,"codigo":"I-120E","referencia_interna":"I-120E","iva":false,"ieps":false,"piezas_por_caja":6},
  {"name":"Etiquetas para Rappi PLA","unit":"Piece","category":"Otros","cost_per_unit":0.28,"codigo":"ETRP00202P","referencia_interna":"I-1210A","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Rollo de Etiquetas Suajadas","unit":"40pcs/ctn","category":"Desechables","cost_per_unit":2902.32,"codigo":"ROETSUA","referencia_interna":"I-12114","iva":true,"ieps":false,"piezas_por_caja":40},
  {"name":"Bolsa de Material Reciclado","unit":"50pcs*ctn","category":"Souvenirs","cost_per_unit":8722.825,"codigo":"340122006","referencia_interna":"I-1211A","iva":true,"ieps":false,"piezas_por_caja":50},
  {"name":"Set de popotes acero inoxidable","unit":"Caja 200","category":"Souvenirs","cost_per_unit":19162.28,"codigo":"1000001837","referencia_interna":"I-1211B","iva":true,"ieps":false,"piezas_por_caja":200},
  {"name":"llavero 3D (Black milk tea)","unit":"Caja 200","category":"Souvenirs","cost_per_unit":12096.77,"codigo":"1000002245","referencia_interna":"I-12120","iva":true,"ieps":false,"piezas_por_caja":200},
  {"name":"llavero 3D Sabor Taro","unit":"Caja 200","category":"Souvenirs","cost_per_unit":14092.54,"codigo":"1000002246","referencia_interna":"I-12121","iva":true,"ieps":false,"piezas_por_caja":200},
  {"name":"llavero de Fresa 3D","unit":"Caja 200","category":"Souvenirs","cost_per_unit":14099.93,"codigo":"1000002248","referencia_interna":"I-12122","iva":true,"ieps":false,"piezas_por_caja":200},
  {"name":"llavero de Matcha 3D","unit":"Caja 200","category":"Souvenirs","cost_per_unit":14216.81,"codigo":"1000002247","referencia_interna":"I-12123","iva":true,"ieps":false,"piezas_por_caja":200},
  {"name":"Galletas Oreo Molidas","unit":"Caja 6 (medio Kg)","category":"Topping","cost_per_unit":687.3,"codigo":"INGAORMO500","referencia_interna":"I-121A","iva":false,"ieps":true,"piezas_por_caja":6},
  {"name":"Batidor (Acero Inoxidable) \"Bailarinas\"","unit":"Piece","category":"Utensilios","cost_per_unit":81.894,"codigo":"32007213","referencia_interna":"I-121B","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Batidor Plástico (530 ml)","unit":"Piece","category":"Utensilios","cost_per_unit":268.93,"codigo":"32164221","referencia_interna":"I-121C","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Batidor Plástico (700 ml)","unit":"Piece","category":"Utensilios","cost_per_unit":303.12,"codigo":"32165221","referencia_interna":"I-121D","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Batidor para tapioca","unit":"Piece","category":"Utensilios","cost_per_unit":262.85,"codigo":"32168233","referencia_interna":"I-121E","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Bolsa Plástica Para 2 Vasos PLA","unit":"1kg*10P/ctn","category":"Desechables","cost_per_unit":498.7,"codigo":"21148260","referencia_interna":"I-1222","iva":true,"ieps":false,"piezas_por_caja":2.6295},
  {"name":"Bolsa Plástica Para 4 Vasos PLA","unit":"1kg*10P/ctn","category":"Desechables","cost_per_unit":1062.513,"codigo":"21149260","referencia_interna":"I-1223","iva":true,"ieps":false,"piezas_por_caja":4.651},
  {"name":"Coladera para tapioca","unit":"Piece","category":"Utensilios","cost_per_unit":492.88,"codigo":"32036233","referencia_interna":"I-122C","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Colador de Té","unit":"Piece","category":"Utensilios","cost_per_unit":115.74,"codigo":"32069213","referencia_interna":"I-122D","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Concentrado de Lichi","unit":"2.5kg*6B/ctn","category":"Jarabes","cost_per_unit":2243.3704,"codigo":"13089140","referencia_interna":"I-122E","iva":false,"ieps":true,"piezas_por_caja":6},
  {"name":"Contenedor Acero Inoxidable (Diámetro 12 cm)","unit":"Piece","category":"Utensilios","cost_per_unit":169.34,"codigo":"32026213","referencia_interna":"I-1231","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Contenedor Plástico","unit":"Piece","category":"Utensilios","cost_per_unit":97.81,"codigo":"32197233","referencia_interna":"I-1232","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Contenedor Térmico Para Té","unit":"Piece","category":"Utensilios","cost_per_unit":1413.34,"codigo":"32153221","referencia_interna":"I-1233","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Contenedor de Café","unit":"Piece","category":"Utensilios","cost_per_unit":175.58,"codigo":"32017213","referencia_interna":"I-1234","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Contenedor plastico para jarabe","unit":"Piece","category":"Utensilios","cost_per_unit":71.01,"codigo":"32019213","referencia_interna":"I-1235","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Cotenedor de pimienta","unit":"Piece","category":"Utensilios","cost_per_unit":157.16,"codigo":"32030213","referencia_interna":"I-1236","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Crema Polvo (Especial)","unit":"400g*48P/ctn","category":"Topping","cost_per_unit":3779.81,"codigo":"11104109","referencia_interna":"I-1238","iva":false,"ieps":true,"piezas_por_caja":48},
  {"name":"Cuchara para perlas de tapioca","unit":"Piece","category":"Utensilios","cost_per_unit":65.96,"codigo":"32156282","referencia_interna":"I-123B","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Cuchara para polvos","unit":"Piece","category":"Utensilios","cost_per_unit":25.25,"codigo":"32008213","referencia_interna":"I-123C","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Cuchara para topping","unit":"Piece","category":"Utensilios","cost_per_unit":44.57,"codigo":"32025233","referencia_interna":"I-123D","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Estantería","unit":"Piece","category":"Utensilios","cost_per_unit":144.28,"codigo":"32004213","referencia_interna":"I-1241","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Estantería para Tapaderas de Olla","unit":"Piece","category":"Utensilios","cost_per_unit":190.84,"codigo":"321842010","referencia_interna":"I-1242","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Etiqueta selladora PLA (transparente)","unit":"3030 pcs*4 rolls/ctn","category":"Desechables","cost_per_unit":6427.71,"codigo":"1000001907","referencia_interna":"I-1246","iva":true,"ieps":false,"piezas_por_caja":4},
  {"name":"Etiqueta selladora de papel","unit":"2000pcs*6roll/ctn","category":"Desechables","cost_per_unit":8254.42,"codigo":"21166284","referencia_interna":"I-1247","iva":true,"ieps":false,"piezas_por_caja":6},
  {"name":"Etiquetas (Enjoy Rojas)","unit":"25pcs*200sheets*40bundle/ctn","category":"Desechables","cost_per_unit":18681.33,"codigo":"22027229","referencia_interna":"I-1249","iva":true,"ieps":false,"piezas_por_caja":40},
  {"name":"Filtro para Cafetera","unit":"50pcs*20P/ctn","category":"Otros","cost_per_unit":438.61,"codigo":"FLTRCOF","referencia_interna":"I-124B","iva":true,"ieps":false,"piezas_por_caja":20},
  {"name":"Filtro para Fetco","unit":"Caja 10 (50 pz)","category":"Otros","cost_per_unit":692.78,"codigo":"FLTRBNN","referencia_interna":"I-124C","iva":true,"ieps":false,"piezas_por_caja":10},
  {"name":"Gelatina de Coco","unit":"3.8kg*4B/ctn","category":"Topping","cost_per_unit":1029.63,"codigo":"16003109","referencia_interna":"I-1252","iva":false,"ieps":false,"piezas_por_caja":4},
  {"name":"Guantes de Polietileno","unit":"Piece","category":"Otros","cost_per_unit":0.4122,"codigo":"GLOV2022","referencia_interna":"I-1255","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Imanes Para Pots","unit":"Piece","category":"Utensilios","cost_per_unit":68.89,"codigo":"32099225","referencia_interna":"I-1257","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Jarabe","unit":"3.3kg*6btl/ctn","category":"Jarabes","cost_per_unit":1790.28,"codigo":"15006104","referencia_interna":"I-1258","iva":false,"ieps":true,"piezas_por_caja":6},
  {"name":"Jarabe de Azucar Morena V2","unit":"Caja 12 (750 ml)","category":"Jarabes","cost_per_unit":1262.04,"codigo":"INJAAZMOV2","referencia_interna":"I-1275","iva":true,"ieps":false,"piezas_por_caja":12},
  {"name":"Jarabe de Caramelo","unit":"1.3kg*12B/ctn","category":"Jarabes","cost_per_unit":3725.14,"codigo":"13018120","referencia_interna":"I-125B","iva":false,"ieps":true,"piezas_por_caja":12},
  {"name":"Jarabe de Durazno","unit":"5kg*4B/ctn","category":"Jarabes","cost_per_unit":1813.02,"codigo":"13002101","referencia_interna":"I-125D","iva":false,"ieps":true,"piezas_por_caja":4},
  {"name":"Jarabe de Fruta de la Pasión","unit":"5kg*4B/ctn","category":"Jarabes","cost_per_unit":1987.7425,"codigo":"13008101","referencia_interna":"I-125E","iva":false,"ieps":true,"piezas_por_caja":4},
  {"name":"Jarabe de Pulpa de Fresa","unit":"1.3kg*12B/ctn","category":"Jarabes","cost_per_unit":2145.29,"codigo":"13003101","referencia_interna":"I-1260","iva":false,"ieps":false,"piezas_por_caja":12},
  {"name":"Jarra chica para milk foam","unit":"Piece","category":"Utensilios","cost_per_unit":83.17,"codigo":"32143221","referencia_interna":"I-1263","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Jarra grande para milk foam","unit":"Piece","category":"Utensilios","cost_per_unit":251.2,"codigo":"32130221","referencia_interna":"I-1264","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Leche de Coco A","unit":"1Lt*12P/ctn","category":"Otros","cost_per_unit":684.42,"codigo":"CM0002","referencia_interna":"I-1267","iva":true,"ieps":false,"piezas_por_caja":12},
  {"name":"Mamilas tienda Unica","unit":"Piece","category":"Utensilios","cost_per_unit":146.63,"codigo":"MAM002022","referencia_interna":"I-126E","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Mangas de Carton","unit":"50pcs*20P/ctn","category":"Desechables","cost_per_unit":922.89,"codigo":"1000001768","referencia_interna":"I-1270","iva":true,"ieps":false,"piezas_por_caja":20},
  {"name":"Nutri Flan","unit":"Caja 25 (Kg)","category":"Polvos","cost_per_unit":1756.5,"codigo":"NUT002021","referencia_interna":"I-1278","iva":false,"ieps":true,"piezas_por_caja":25},
  {"name":"Olla de Acero Inoxidable ( 10,000 cc)","unit":"Piece","category":"Utensilios","cost_per_unit":994.72,"codigo":"32040213","referencia_interna":"I-1279","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Olla de Acero Inoxidable (15000cc)","unit":"Piece","category":"Utensilios","cost_per_unit":1390.78,"codigo":"32041213","referencia_interna":"I-127A","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Olla de Acero Inoxidable (16cm)","unit":"Piece","category":"Utensilios","cost_per_unit":264.75,"codigo":"32027213","referencia_interna":"I-127B","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Olla de Acero Inoxidable (22cm)","unit":"Piece","category":"Utensilios","cost_per_unit":715.18,"codigo":"32028213","referencia_interna":"I-127C","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Pala para hielos","unit":"Piece","category":"Utensilios","cost_per_unit":203.06,"codigo":"1000001972","referencia_interna":"I-1281","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Perlas de tapioca","unit":"3kg*6P/ctn","category":"Topping","cost_per_unit":1057.02,"codigo":"1000002231","referencia_interna":"I-1286","iva":false,"ieps":false,"piezas_por_caja":6},
  {"name":"Platos para postre","unit":"Piece","category":"Utensilios","cost_per_unit":48.62,"codigo":"PLA002022","referencia_interna":"I-1288","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Polvo Sabor Matcha o Té Verde","unit":"1kg*10P/ctn","category":"Polvos","cost_per_unit":2630.14,"codigo":"11094184","referencia_interna":"I-128F","iva":false,"ieps":true,"piezas_por_caja":10},
  {"name":"Polvo Sabor Té Chai","unit":"1kg*10P/ctn","category":"Polvos","cost_per_unit":2699.71,"codigo":"11033138","referencia_interna":"I-1291","iva":false,"ieps":true,"piezas_por_caja":10},
  {"name":"Polvo para Frappes","unit":"1.3kg*5P/Box","category":"Polvos","cost_per_unit":2758.89,"codigo":"FRA002021","referencia_interna":"I-1292","iva":false,"ieps":true,"piezas_por_caja":5},
  {"name":"Popote Grueso Biodegradable Local","unit":"50pcs*60pkt/ctn","category":"Desechables","cost_per_unit":2196,"codigo":"P072022OB","referencia_interna":"I-1295","iva":true,"ieps":false,"piezas_por_caja":60},
  {"name":"Popote Grueso Compostable Local","unit":"50pcs*60pkt/ctn","category":"Desechables","cost_per_unit":2928,"codigo":"P082022CP","referencia_interna":"I-1296","iva":true,"ieps":false,"piezas_por_caja":60},
  {"name":"Puré de Mango","unit":"2.5kg*6B/ctn","category":"Jarabes","cost_per_unit":3350.81,"codigo":"13053120","referencia_interna":"I-1298","iva":true,"ieps":true,"piezas_por_caja":6},
  {"name":"Rollo Termico","unit":"Pieces","category":"Desechables","cost_per_unit":1505.72,"codigo":"ROETP1","referencia_interna":"I-129A","iva":true,"ieps":false,"piezas_por_caja":50},
  {"name":"Rollo de etiquetas","unit":"40pcs/ctn","category":"Desechables","cost_per_unit":2684.48,"codigo":"ROET","referencia_interna":"I-129B","iva":true,"ieps":false,"piezas_por_caja":40},
  {"name":"Sartén","unit":"Piece","category":"Utensilios","cost_per_unit":187.95,"codigo":"32194233","referencia_interna":"I-129D","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Sobres rojos para GC","unit":"Piece","category":"Otros","cost_per_unit":2.71,"codigo":"SRGC2022","referencia_interna":"I-129F","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Tapa del recipiente para té","unit":"Piece","category":"Utensilios","cost_per_unit":521.14,"codigo":"32136213","referencia_interna":"I-12A5","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Tapa tipo domo","unit":"100pcs*20P/ctn","category":"Desechables","cost_per_unit":1767.47,"codigo":"21066227","referencia_interna":"I-12A8","iva":true,"ieps":false,"piezas_por_caja":20},
  {"name":"Tapa tipo domo PLA","unit":"50pcs*20pkt/ctn","category":"Desechables","cost_per_unit":1820.85,"codigo":"21239284","referencia_interna":"I-12A9","iva":true,"ieps":false,"piezas_por_caja":20},
  {"name":"Tapadera Plástica Color Rojo","unit":"50pcs*20P/ctn","category":"Desechables","cost_per_unit":1389.58,"codigo":"21167284","referencia_interna":"I-12AC","iva":true,"ieps":false,"piezas_por_caja":20},
  {"name":"Tapadera de Acero Inoxidable","unit":"Piece","category":"Utensilios","cost_per_unit":142.61,"codigo":"32167213","referencia_interna":"I-12AD","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Tapadera para Shaker de plástico","unit":"Piece","category":"Otros","cost_per_unit":292.38,"codigo":"32133221","referencia_interna":"I-12AE","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Tapioca Blanca","unit":"2kg*6P/ctn","category":"Topping","cost_per_unit":1226.25,"codigo":"16017142","referencia_interna":"I-12B3","iva":false,"ieps":false,"piezas_por_caja":6},
  {"name":"Tapioca blanca sabor fresa","unit":"2kg*6P/ctn","category":"Topping","cost_per_unit":1352.92,"codigo":"16025142","referencia_interna":"I-12B5","iva":false,"ieps":false,"piezas_por_caja":6},
  {"name":"Taza Medidora (Capacidad 100 cc) Plástico","unit":"Piece","category":"Utensilios","cost_per_unit":28.93,"codigo":"32048213","referencia_interna":"I-12B7","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Taza Medidora (Capacidad 300cc) Plástico","unit":"Piece","category":"Utensilios","cost_per_unit":53.5,"codigo":"32049213","referencia_interna":"I-12B8","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Taza Medidora (Capacidad 5,000 cc) Plástico","unit":"Piece","category":"Utensilios","cost_per_unit":27.92,"codigo":"32128221","referencia_interna":"I-12B9","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Taza Medidora (Capacidad 500 cc) Acero Inoxidable","unit":"Piece","category":"Utensilios","cost_per_unit":148.06,"codigo":"32161213","referencia_interna":"I-12BA","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Taza Medidora (Capacidad 500 cc) Plástico","unit":"Piece","category":"Utensilios","cost_per_unit":57.35,"codigo":"32129221","referencia_interna":"I-12BB","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Tela Filtrante","unit":"Unidades 12 pz","category":"Insumos","cost_per_unit":792.54,"codigo":"32039213","referencia_interna":"I-12BC","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Té Negro","unit":"150g*80P/ctn","category":"Té y café","cost_per_unit":6062.54,"codigo":"12053156","referencia_interna":"I-12C1","iva":false,"ieps":false,"piezas_por_caja":80},
  {"name":"Té Oolong","unit":"150g*80P/ctn","category":"Té y café","cost_per_unit":8528.8,"codigo":"12011119","referencia_interna":"I-12C2","iva":false,"ieps":false,"piezas_por_caja":80},
  {"name":"Té Verde en Hoja","unit":"150g*80P/ctn","category":"Té y café","cost_per_unit":8200.42,"codigo":"12002110","referencia_interna":"I-12C3","iva":false,"ieps":false,"piezas_por_caja":80},
  {"name":"Vaso 16 Onzas PLA","unit":"50pcs*20pkt/ctn","category":"Desechables","cost_per_unit":4385.9,"codigo":"21236284","referencia_interna":"I-12C8","iva":true,"ieps":false,"piezas_por_caja":20},
  {"name":"Vaso 24 Onzas PLA","unit":"50pcs*20pkt/ctn","category":"Desechables","cost_per_unit":5352.14,"codigo":"21237284","referencia_interna":"I-12CA","iva":true,"ieps":false,"piezas_por_caja":20},
  {"name":"Vaso de Papel Tamaño 16 onzas","unit":"50pcs*20P/ctn","category":"Desechables","cost_per_unit":2027.34,"codigo":"21174218","referencia_interna":"I-12CE","iva":true,"ieps":false,"piezas_por_caja":20},
  {"name":"Vaso de Papel Tamaño 2 onzas","unit":"50pcs*40P/ctn","category":"Desechables","cost_per_unit":1140,"codigo":"21154284","referencia_interna":"I-12CF","iva":true,"ieps":false,"piezas_por_caja":40},
  {"name":"Vaso de Plástico Tamaño 16 onzas","unit":"100pcs*20P/ctn","category":"Desechables","cost_per_unit":2716.34,"codigo":"21140284","referencia_interna":"I-12D0","iva":true,"ieps":false,"piezas_por_caja":20},
  {"name":"Vaso de Plástico tamaño 22 onzas","unit":"50pcs*20P/ctn","category":"Desechables","cost_per_unit":2000.01,"codigo":"21136227","referencia_interna":"I-12D1","iva":true,"ieps":false,"piezas_por_caja":20},
  {"name":"Popote Biodegradable Delgado Local","unit":"Caja 10 (100 pz)","category":"Desechables","cost_per_unit":488,"codigo":"P102022DB","referencia_interna":"I-12F0","iva":true,"ieps":false,"piezas_por_caja":10},
  {"name":"Popote Compostable Delgado Local","unit":"1000pcs/ctn","category":"Desechables","cost_per_unit":610,"codigo":"P122022DC","referencia_interna":"I-12F1","iva":true,"ieps":false,"piezas_por_caja":1000},
  {"name":"Placa Plástica para Nombre","unit":"piece","category":"Uniformes","cost_per_unit":80.43,"codigo":"29086275","referencia_interna":"U-1587","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Popote GongCha","unit":"Unidades","category":"Souvenirs","cost_per_unit":51.15,"codigo":"SOUPOGON","referencia_interna":"S-138","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Boba 3D Red","unit":"Unidades","category":"Souvenirs","cost_per_unit":120.6897,"codigo":"SOUGOBO3DFR","referencia_interna":"I-12C4","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Boba 3D Tiny Cups","unit":"Unidades","category":"Souvenirs","cost_per_unit":120.6897,"codigo":"SOUGOBO3DSE","referencia_interna":"I-12C5","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Lucas Muecas Topping","unit":"Caja 8 (1.360 kg)","category":"Topping","cost_per_unit":2871.14,"codigo":"INPOLVOMUETOPP","referencia_interna":"I-1265","iva":false,"ieps":false,"piezas_por_caja":8},
  {"name":"Cafe Molido V2","unit":"Caja 6 (kg)","category":"Té y café","cost_per_unit":2232,"codigo":"INCAFMOV2","referencia_interna":"I-12C7","iva":false,"ieps":false,"piezas_por_caja":6},
  {"name":"Polvo Sabor Chocolate V2","unit":"Caja 10 (Kg)","category":"Polvos","cost_per_unit":2385.22,"codigo":"INPOSACHOV2","referencia_interna":"I-1276","iva":true,"ieps":false,"piezas_por_caja":10},
  {"name":"Vaso 32 Oz PP V2","unit":"Caja 20 (25 pz)","category":"Desechables","cost_per_unit":2952.06,"codigo":"I-1214A","referencia_interna":"I-1214A","iva":true,"ieps":false,"piezas_por_caja":10},
  {"name":"Tapa plana p/32Oz V2","unit":"Caja 10 (50 pz)","category":"Desechables","cost_per_unit":594.29,"codigo":"I-12149","referencia_interna":"I-12149","iva":true,"ieps":false,"piezas_por_caja":20},
  {"name":"Playera Roja Chica","unit":"Unidades","category":"Uniformes","cost_per_unit":189.66,"codigo":"U-1505","referencia_interna":"U-1505","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Playera Roja Mediana","unit":"Unidades","category":"Uniformes","cost_per_unit":189.66,"codigo":"U-1506","referencia_interna":"U-1506","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Playera Roja Grande","unit":"Unidades","category":"Uniformes","cost_per_unit":189.66,"codigo":"U-1507","referencia_interna":"U-1507","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Playera Roja XXG","unit":"Unidades","category":"Uniformes","cost_per_unit":189.66,"codigo":"U-1509","referencia_interna":"U-1509","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Playera Negra Chica","unit":"Unidades","category":"Uniformes","cost_per_unit":189.66,"codigo":"U-150A","referencia_interna":"U-150A","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Playera Negra Mediana","unit":"Unidades","category":"Uniformes","cost_per_unit":189.66,"codigo":"U-150B","referencia_interna":"U-150B","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Playera Negra Grande","unit":"Unidades","category":"Uniformes","cost_per_unit":189.66,"codigo":"U-150C","referencia_interna":"U-150C","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Playera Negra XXG","unit":"Unidades","category":"Uniformes","cost_per_unit":189.66,"codigo":"U-150E","referencia_interna":"U-150E","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Mandil Negro","unit":"Unidades","category":"Uniformes","cost_per_unit":146.5517,"codigo":"U-150F","referencia_interna":"U-150F","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Mandil Rojo","unit":"Unidades","category":"Uniformes","cost_per_unit":146.5517,"codigo":"U-1510","referencia_interna":"U-1510","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Gorra Negra","unit":"Unidades","category":"Uniformes","cost_per_unit":129.3104,"codigo":"U-1511","referencia_interna":"U-1511","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Gorra Roja","unit":"Unidades","category":"Uniformes","cost_per_unit":129.3104,"codigo":"U-1512","referencia_interna":"U-1512","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Playera Roja XG","unit":"Unidades","category":"Uniformes","cost_per_unit":189.66,"codigo":"U-1508","referencia_interna":"U-1508","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Playera Negra XG","unit":"Unidades","category":"Uniformes","cost_per_unit":189.66,"codigo":"U-150D","referencia_interna":"U-150D","iva":true,"ieps":false,"piezas_por_caja":1},
  {"name":"Llavero 3D Line Friends","unit":"Caja 200","category":"Souvenirs","cost_per_unit":16894.5259,"codigo":"S-1312","referencia_interna":"S-1312","iva":true,"ieps":false,"piezas_por_caja":200},
  {"name":"Preparado de Mango Manila","unit":"Caja 4 (2.35 Kg)","category":"Jarabes","cost_per_unit":1231.54,"codigo":"I-127E","referencia_interna":"I-127E","iva":false,"ieps":false,"piezas_por_caja":4},
  {"name":"Etiqueta selladora V3","unit":"Caja 8 (3043)","category":"Desechables","cost_per_unit":5956.16,"codigo":"I-12177","referencia_interna":"I-12177","iva":true,"ieps":false,"piezas_por_caja":8},
  {"name":"Polvo Sabor Horchata","unit":"Caja 8 (1.360 kg)","category":"Insumos","cost_per_unit":1868.59,"codigo":"I-12138","referencia_interna":"I-12138","iva":false,"ieps":true,"piezas_por_caja":8},
  {"name":"Polvo Sabor Arandano Enchilado","unit":"Caja 10 (Kg)","category":"Insumos","cost_per_unit":2485.95,"codigo":"I-12172","referencia_interna":"I-12172","iva":false,"ieps":false,"piezas_por_caja":10},
  {"name":"Polvo Sabor Limonada Sal y Miel","unit":"Caja 10 (Kg)","category":"Insumos","cost_per_unit":2232.99,"codigo":"I-12173","referencia_interna":"I-12173","iva":false,"ieps":false,"piezas_por_caja":10},
  {"name":"Polvo Sabor Mandarina Jengibre","unit":"Caja 10 (Kg)","category":"Insumos","cost_per_unit":2407.83,"codigo":"I-12171","referencia_interna":"I-12171","iva":false,"ieps":false,"piezas_por_caja":10},
  {"name":"Polvo Sabor Taro V2","unit":"Caja 20 (kg)","category":"Insumos","cost_per_unit":5084,"codigo":"I-12178","referencia_interna":"I-12178","iva":false,"ieps":false,"piezas_por_caja":20},
  {"name":"Ghirandelli Chocolate Blanco","unit":"Caja 6 (1.41 Kg)","category":"Insumos","cost_per_unit":3277.3241,"codigo":"I-12179","referencia_interna":"I-12179","iva":false,"ieps":true,"piezas_por_caja":6},
] as const

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const results = { migration: '', inserted: 0, updated: 0, errors: [] as string[] }

  // ── 1. Ejecutar migración 002 via DATABASE_URL si está disponible ──────────
  if (process.env.DATABASE_URL) {
    try {
      const { getPool } = await import('@/shared/lib/db')
      const db = getPool()
      const client = await db.connect()
      try {
        const { readFileSync } = await import('fs')
        const { join } = await import('path')
        const sql = readFileSync(
          join(process.cwd(), 'supabase', 'migrations', '002_adjust_supplies_catalog.sql'),
          'utf-8'
        )
        await client.query(sql)
        results.migration = 'migration 002 applied via DATABASE_URL'
      } finally {
        client.release()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        results.migration = 'migration 002 already applied'
      } else {
        results.migration = `migration 002 skipped: ${msg}`
      }
    }
  } else {
    results.migration = 'DATABASE_URL not set — DDL migration skipped (run 002 manually in Supabase Studio)'
  }

  // ── 2. Detectar si las columnas nuevas ya existen ─────────────────────────
  const { data: testRow } = await supabase.from('supplies').select('id').limit(1).single()
  let hasNewColumns = false
  if (testRow) {
    const { data: colCheck } = await supabase
      .from('supplies')
      .select('codigo')
      .eq('id', testRow.id)
      .single()
    hasNewColumns = colCheck !== null && 'codigo' in (colCheck ?? {})
  }

  // ── 3. Upsert en lotes de 50 ──────────────────────────────────────────────
  const BATCH = 50
  for (let i = 0; i < CATALOG.length; i += BATCH) {
    const batch = CATALOG.slice(i, i + BATCH)

    const records = batch.map((p) => {
      const base = {
        name: p.name,
        unit: p.unit,
        category: p.category,
        cost_per_unit: p.cost_per_unit,
        active: true,
      }
      if (!hasNewColumns) return base
      return {
        ...base,
        codigo: p.codigo,
        referencia_interna: p.referencia_interna,
        iva: p.iva,
        ieps: p.ieps,
        piezas_por_caja: p.piezas_por_caja,
      }
    })

    const { error } = await supabase
      .from('supplies')
      .upsert(records, { onConflict: 'name', ignoreDuplicates: false })

    if (error) {
      results.errors.push(`Batch ${i}-${i + BATCH}: ${error.message}`)
    } else {
      results.inserted += batch.length
    }
  }

  return NextResponse.json({
    ...results,
    total: CATALOG.length,
    columnsExtended: hasNewColumns,
    message: results.errors.length === 0
      ? `✅ ${results.inserted} insumos cargados exitosamente`
      : `⚠️ Parcialmente completado con ${results.errors.length} errores`,
  })
}
