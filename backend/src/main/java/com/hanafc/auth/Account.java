package com.hanafc.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "accounts")
public class Account {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 40)
    private String username;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 10)
    private AccountRole role;

    @Column(nullable = false)
    private boolean enabled = true;

    protected Account() { }

    public static Account create(String username, String passwordHash, AccountRole role) {
        if (username == null || !username.matches("[a-z][a-z0-9_.-]{2,39}")) {
            throw new IllegalArgumentException("아이디는 영문 소문자로 시작하는 3~40자여야 합니다.");
        }
        if (passwordHash == null || !passwordHash.matches("\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{53}")) {
            throw new IllegalArgumentException("BCrypt 해시가 필요합니다.");
        }
        Account account = new Account();
        account.username = username;
        account.passwordHash = passwordHash;
        account.role = Objects.requireNonNull(role);
        return account;
    }

    public String getUsername() { return username; }
    public String getPasswordHash() { return passwordHash; }
    public AccountRole getRole() { return role; }
    public boolean isEnabled() { return enabled; }
}
