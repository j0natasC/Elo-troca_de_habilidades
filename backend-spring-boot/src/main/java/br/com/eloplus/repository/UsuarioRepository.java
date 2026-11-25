package br.com.eloplus.repository;

import br.com.eloplus.model.UsuarioEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<UsuarioEntity, Long> {
    Optional<UsuarioEntity> findByEmailIgnoreCase(String email);
    Optional<UsuarioEntity> findByNomeIgnoreCase(String nome);
    boolean existsByEmailIgnoreCase(String email);
}
