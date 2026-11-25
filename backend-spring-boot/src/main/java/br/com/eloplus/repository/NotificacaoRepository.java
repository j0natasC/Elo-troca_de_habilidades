package br.com.eloplus.repository;

import br.com.eloplus.model.NotificacaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NotificacaoRepository extends JpaRepository<NotificacaoEntity, Long> {
    List<NotificacaoEntity> findByPerfilIdOrderByDataDesc(Long perfilId);
}
