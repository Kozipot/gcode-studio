#1  = 40      (RADIUS VNESHNIH VERSHIN)
#2  = 15      (RADIUS VNUTRENNIH VPADIN)
#9  = 0       (CENTR X)
#19 = 0       (CENTR Y)
#7  = 1       (GLUBINA ZA PROHOD)
#8  = 10      (CHISLO PROHODOV)
#10 = 5       (SCHETCHIK PROHODOV)
#11 = 90      (UGOL PERVOY VERSHINY)
#12 = 36      (SHAG MEZHDU TOCHKAMI)
#13 = 5       (CHISLO LUCHEY ZVEZDY)

G21 G90
M3 S1200
G0 Z10.
G0 X[#9 + #1 * COS[#11]] Y[#19 + #1 * SIN[#11]]

WHILE [#10 LE #8] DO1
  #16 = #11
  G0 X[#9 + #1 * COS[#16]] Y[#19 + #1 * SIN[#16]]
  G1 Z[-#10 * #7] F100

  #14 = 2
  WHILE [#14 LE [#13 * 2]] DO2
    #16 = #11 - #12 * [#14 - 1]
    #17 = #2 + [#1 - #2] * [[1 - COS[180 * #14]] / 2]
    G1 X[#9 + #17 * COS[#16]] Y[#19 + #17 * SIN[#16]]
    #14 = #14 + 1
  END2

  G1 X[#9 + #1 * COS[#11]] Y[#19 + #1 * SIN[#11]]

  #10 = #10 + 1
END1

G0 Z50.
M5
M30
