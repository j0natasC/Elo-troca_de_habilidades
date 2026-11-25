package br.com.eloplus.repository;

import br.com.eloplus.model.PerfilEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PerfilRepository extends JpaRepository<PerfilEntity, Long> {
    Optional<PerfilEntity> findByUsuarioId(Long usuarioId);
}
