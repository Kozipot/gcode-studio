%
O1000 (EMBLEM GEAR + WHEAT + OAK LEAVES - FANUC MACRO)
(ZERO: X0 Y0 IN CENTER, Z0 TOP SURFACE)

(--- MAIN PARAMETERS ---)
#1 = 13         (NUMBER OF GEAR TEETH)
#2 = 48.0      (GEAR ROOT RADIUS - VPADINA)
#3 = 68.0      (GEAR TIP RADIUS - VERSHINA)
#4 = 38.0      (INNER GREEN RING RADIUS)
#5 = 35.5      (INNER GROOVE RADIUS)
#6 = 2       (TOOTH TIP HALF-ANGLE, DEG)
#7 = 13.5      (TOOTH ROOT HALF-ANGLE, DEG)

#8 = -11.0      (GEAR CUT DEPTH Z)
#9 = -1.0      (STEP DOWN Z)
#10 = 1200.0   (FEED XY)
#11 = 400.0    (PLUNGE Z)
#12 = 12000    (SPINDLE SPEED)
#13 = 5.0      (SAFE Z)

(--- INIT ---)
G17 G21 G40 G49 G80 G90
T1 M06
S#12 M03
G00 X0. Y0.
G00 Z#13

(========================================================)
(1. OUTER 8-TOOTH GEAR CONTOUR (PURE TRIGONOMETRY LOOP)   )
(========================================================)
#20 = #9
#21 = [360.0 / #1]       (45 DEG PER TOOTH)

WHILE [#20 GE #8] DO1
  (START POINT: TOOTH 0 ROOT START)
  #22 = 0.0
  #23 = [#22 - #7]
  G00 X[#2 * COS[#23]] Y[#2 * SIN[#23]]
  G01 Z#20 F#11

  WHILE [#22 LT 360.0] DO2
    (1. FLANK UP: ROOT -> TIP)
    #24 = [#22 - #6]
    G01 X[#3 * COS[#24]] Y[#3 * SIN[#24]] F#10

    (2. TOOTH TIP ARC: G03 CCW FROM -#6 TO +#6)
    #25 = [#22 + #6]
    G03 X[#3 * COS[#25]] Y[#3 * SIN[#25]] R#3

    (3. FLANK DOWN: TIP -> ROOT)
    #26 = [#22 + #7]
    G01 X[#2 * COS[#26]] Y[#2 * SIN[#26]]

    (4. TOOTH ROOT ARC: G03 CCW TO NEXT TOOTH START)
    #27 = [#22 + #21 - #7]
    G03 X[#2 * COS[#27]] Y[#2 * SIN[#27]] R#2

    #22 = [#22 + #21]
  END2

  G00 Z#13
  #20 = [#20 + #9]
END1

O1003 (FANUC_CYLINDER_NESTED_LOOPS)
(VVEDENIE PEREMENNYH)
#1 = 55   (DIAMETR - vneshniy diametr)
#2 = 11   (GLUBINA - obshchaya glubina)
#3 = 1    (SHAG - shag po osi Z)
#4 = 5    (BEZOPASNAYA_VYSOTA - otvod Z+5)
#5 = 4    (SHAG_PO_RADIUSU - shag smeshcheniya k tsentru)

#6 = [#1 / 2] (TEKUSHCHIY_RADIUS - nachinaem s vneshnego)
#7 = 0        (TEKUSHCHAYA_GLUBINA)

(START)
G21 G90 G17 G40 G49 G80
G54
T1 M6
S2500 M3
G0 Z#4 (Vyhod na bezopasnuyu vysotu)
G0 X0 Y0

(VNESHNIY CIKL - PEREBOR KRUGOV OT KRAYA K TSENTRU)
WHILE [#6 GE 0] DO1
  
  #7 = 0 (Sbros glubiny dlya kazhdogo novogo kruga)
  
  (VNUTRENNIY CIKL - OBRABOTKA SLOEV SVERHU VNIZ)
  WHILE [#7 LT #2] DO2
    
    #7 = [#7 + #3] (Pribavlyaem shag po glubine)
    IF [#7 GT #2] THEN #7 = #2 (Zashchita ot perekopa glubiny)
    
    (--- ZHESTKOE PRAVILO BEZOPASNOSTI ---)
    G0 Z#4 (1. PODEM: friza vsegda podnimaetsya na +5)
    G0 X#6 Y0 (2. PEREHOD: bystryy perehod po vozduhu k tekushchemu radiusu)
    G1 Z-#7 F200 (3. VRUZANIE: strogo vertikalnyy spusk na glubinu)
    
    (FREZEROVANIE KRUGA)
    IF [#6 EQ 0] GOTO 10 (Zashchita ot oshibki Fanuc: esli radius 0, krug ne rezem)
    G3 I-#6 J0 F500 (Rezem polnyy krug)
    N10 (Metka dlya perehoda)
    
  END2 (Konec vnutrennego cikla po Z)
  
  #6 = [#6 - #5] (UMENSHAEM RADIUS dlya sleduyushchego kruga)
  
END1 (Konec vneshnego cikla po radiusu)

(FINAL)
G0 Z#4 (Okonchatelnyy otvod na bezopasnuyu vysotu)
G0 X0 Y0
M5
M30

(--- END ---)
G00 Z#13
M05
G00 X0. Y0.
M30
%
