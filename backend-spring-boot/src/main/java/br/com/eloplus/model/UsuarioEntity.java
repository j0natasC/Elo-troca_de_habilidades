package br.com.eloplus.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "usuarios")
public class UsuarioEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 14, unique = true)
    private String cpf;

    @Column(length = 120, nullable = false)
    private String nome;

    @Column(length = 120, nullable = false, unique = true)
    private String email;

    @Column(length = 20)
    private String telefone;

    @Column(length = 255, nullable = false)
    private String senha;

    @Column(name = "data_nascimento")
    private LocalDate dataNascimento;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "endereco_id")
    private EnderecoEntity endereco;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCpf() { return cpf; }
    public void setCpf(String cpf) { this.cpf = cpf; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getTelefone() { return telefone; }
    public void setTelefone(String telefone) { this.telefone = telefone; }
    public String getSenha() { return senha; }
    public void setSenha(String senha) { this.senha = senha; }
    public LocalDate getDataNascimento() { return dataNascimento; }
    public void setDataNascimento(LocalDate dataNascimento) { this.dataNascimento = dataNascimento; }
    public EnderecoEntity getEndereco() { return endereco; }
    public void setEndereco(EnderecoEntity endereco) { this.endereco = endereco; }
}
