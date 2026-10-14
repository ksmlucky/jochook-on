package com.hanafc.player;

// 미리보기에서 잘못된 값도 그대로 보여 주기 위해 업로드/표 입력을 문자열로 받는다.
public record BulkPlayerRow(String name, String position, String shirtNumber, String joinedOn,
                            String firstChoice, String secondChoice, String thirdChoice, String birthYear, String clubRole) { }
