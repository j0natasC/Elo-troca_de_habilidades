package br.com.eloplus.model;

import jakarta.persistence.*;

@Entity
@Table(name = "enderecos")
public class EnderecoEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "numero_casa")
    private Integer numeroCasa;

    @Column(length = 60, nullable = false)
    private String logradouro = "Av. das Nações Unidas";

    @Column(length = 45, nullable = false)
    private String bairro = "Jardim São Luís";

    @Column(length = 30)
    private String distrito = "Zona Sul";

    @Column(length = 45, nullable = false)
    private String municipio = "São Paulo";

    @Column(length = 32, nullable = false)
    private String estado = "SP";

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Integer getNumeroCasa() { return numeroCasa; }
    public void setNumeroCasa(Integer numeroCasa) { this.numeroCasa = numeroCasa; }
    public String getLogradouro() { return logradouro; }
    public void setLogradouro(String logradouro) { this.logradouro = logradouro; }
    public String getBairro() { return bairro; }
    public void setBairro(String bairro) { this.bairro = bairro; }
    public String getDistrito() { return distrito; }
    public void setDistrito(String distrito) { this.distrito = distrito; }
    public String getMunicipio() { return municipio; }
    public void setMunicipio(String municipio) { this.municipio = municipio; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
}
